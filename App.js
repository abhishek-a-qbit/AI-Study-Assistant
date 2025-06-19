import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, updateDoc, doc } from 'firebase/firestore';

// Function to render text potentially containing LaTeX
// It looks for $inline$ and $$display$$ math.
const renderTextWithLatex = (text) => {
    // Check if KaTeX library is loaded
    if (typeof window.katex === 'undefined') {
        console.warn("KaTeX library not loaded. LaTeX rendering skipped.");
        return <>{text}</>; // Changed from <p>{text}</p> to prevent nesting errors
    }

    const parts = [];
    let lastIndex = 0;

    // Regex to find inline $...$ and display $$...$$
    // (?:) non-capturing group
    // \$: matches a literal dollar sign
    // ([\s\S]*?): matches any character (including newline) non-greedily
    // |: OR
    const latexRegex = /(\$\$)([\s\S]*?)(\$\$)|(\$)([\s\S]*?)(\$)/g;
    let match;

    while ((match = latexRegex.exec(text)) !== null) {
        // Add preceding plain text
        if (match.index > lastIndex) {
            parts.push(<span key={`text-plain-${lastIndex}`}>{text.substring(lastIndex, match.index)}</span>);
        }

        const fullMatch = match[0];
        let latexContent;
        let displayMode = false;

        // Check if it's a display math match ($$)
        if (match[1] === '$$') {
            latexContent = match[2]; // Content between $$...$$
            displayMode = true;
        } else if (match[4] === '$') {
            latexContent = match[5]; // Content between $...$
            displayMode = false;
        }

        try {
            // Render LaTeX using KaTeX
            const renderedHtml = window.katex.renderToString(latexContent, {
                throwOnError: false, // Do not throw an error; show invalid LaTeX as text
                displayMode: displayMode,
            });
            parts.push(<span key={`latex-${match.index}`} dangerouslySetInnerHTML={{ __html: renderedHtml }} />);
        } catch (e) {
            console.error("KaTeX rendering error:", e);
            // Fallback to plain text with an error indicator if rendering fails
            parts.push(<span key={`latex-error-${match.index}`} className="text-red-500 border border-red-300 p-1 rounded">Error: {fullMatch}</span>);
        }
        lastIndex = latexRegex.lastIndex;
    }

    // Add any remaining plain text after the last LaTeX match
    if (lastIndex < text.length) {
        parts.push(<span key={`text-plain-end-${lastIndex}`}>{text.substring(lastIndex)}</span>);
    }

    // React fragment to return multiple children
    return <>{parts}</>;
};

// Main App component
const App = () => {
    // State for notes, tasks, and study plan input/output
    const [noteInput, setNoteInput] = useState('');
    const [summarizedNote, setSummarizedNote] = useState('');
    const [tasks, setTasks] = useState([]);
    const [taskInput, setTaskInput] = useState('');
    const [studyGoalInput, setStudyGoalInput] = useState('');
    const [studyPlanOutput, setStudyPlanOutput] = useState('');
    const [isLoading, setIsLoading] = useState(false); // For AI loading states in Notes/Study Plan

    // Firebase authentication and Firestore setup
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false); // To track if auth state is settled

    // New states for Flashcard/Quiz
    const [quizInput, setQuizInput] = useState('');
    const [quizOutput, setQuizOutput] = useState('');
    const [isQuizLoading, setIsQuizLoading] = useState(false);

    // New states for AI Explanation
    const [explanationQuestion, setExplanationQuestion] = useState('');
    const [explanationAnswer, setExplanationAnswer] = useState('');
    const [isExplanationLoading, setIsExplanationLoading] = useState(false);

    // New states for Daily Study Quote/Tip
    const [dailyTip, setDailyTip] = useState('');
    const [isDailyTipLoading, setIsDailyTipLoading] = useState(false);

    // New states for Pomodoro Timer
    const [timerMinutes, setTimerMinutes] = useState(25);
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [isBreak, setIsBreak] = useState(false);
    const [currentSessionType, setCurrentSessionType] = useState('Pomodoro'); // 'Pomodoro' or 'Short Break' or 'Long Break'
    const timerRef = useRef(null);

    // Initialize Firebase and listen for auth state changes
    useEffect(() => {
        const initializeFirebase = async () => {
            try {
                // Global variables from Canvas environment
                const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
                const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

                const app = initializeApp(firebaseConfig);
                const firestoreDb = getFirestore(app);
                const firebaseAuth = getAuth(app);

                setDb(firestoreDb);
                setAuth(firebaseAuth);

                // Sign in if a custom token is provided, otherwise sign in anonymously
                const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                if (initialAuthToken) {
                    await signInWithCustomToken(firebaseAuth, initialAuthToken);
                } else {
                    await signInAnonymously(firebaseAuth);
                }

                // Listen for auth state changes to get the user ID
                onAuthStateChanged(firebaseAuth, (user) => {
                    if (user) {
                        setUserId(user.uid);
                        console.log("User ID:", user.uid);
                    } else {
                        // For unauthenticated users, generate a random UUID for temporary persistence
                        setUserId(crypto.randomUUID());
                        console.log("No user signed in. Using anonymous ID.");
                    }
                    setIsAuthReady(true); // Mark auth as ready
                });
            } catch (error) {
                console.error("Error initializing Firebase:", error);
            }
        };

        initializeFirebase();
    }, []);

    // Effect to fetch tasks from Firestore when db and userId are ready
    useEffect(() => {
        if (!db || !userId || !isAuthReady) {
            console.log("Firestore or User ID not ready, or Auth not settled.");
            return;
        }

        // Use __app_id for the collection path as specified in guidelines
        const tasksCollectionRef = collection(db, `artifacts/${__app_id}/users/${userId}/tasks`);

        const unsubscribe = onSnapshot(tasksCollectionRef, (snapshot) => {
            const fetchedTasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Sort tasks by createdAt to maintain order
            fetchedTasks.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            setTasks(fetchedTasks);
        }, (error) => {
            console.error("Error fetching tasks:", error);
        });

        // Cleanup the listener on component unmount
        return () => unsubscribe();
    }, [db, userId, isAuthReady]); // Add isAuthReady to dependencies

    // Effect to fetch daily study tip on component mount
    useEffect(() => {
        const fetchDailyTip = async () => {
            const prompt = "Generate a concise, positive, and actionable study tip or motivational quote for today. Also, mention that the app can now properly display LaTeX mathematics using $inline$ and $$display$$ formats.";
            const tip = await callGeminiAPI(prompt, setIsDailyTipLoading);
            setDailyTip(tip);
        };
        fetchDailyTip();
    }, []); // Run only once on mount

    // Function to call Gemini API for text generation
    const callGeminiAPI = async (prompt, setLoadingState) => {
        setLoadingState(true); // Use the provided loading state setter
        try {
            let chatHistory = [];
            chatHistory.push({ role: "user", parts: [{ text: prompt }] });
            const payload = { contents: chatHistory };
            const apiKey = ""; // API key is provided by Canvas runtime for gemini-2.0-flash
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('API Error:', errorData);
                throw new Error(`API request failed with status ${response.status}: ${errorData.error.message}`);
            }

            const result = await response.json();
            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                return result.candidates[0].content.parts[0].text;
            } else {
                console.warn("Gemini API response did not contain expected content.");
                return "No response from AI.";
            }
        } catch (error) {
            console.error("Error calling Gemini API:", error);
            return "Failed to get AI response. Please try again.";
        } finally {
            setLoadingState(false); // Ensure loading state is reset
        }
    };

    // --- Note-taking Functions ---
    const handleSummarizeNote = async () => {
        if (!noteInput.trim()) {
            setSummarizedNote("Please enter some text to summarize.");
            return;
        }
        const prompt = `Summarize the following notes concisely: \n\n"${noteInput}"`;
        const summary = await callGeminiAPI(prompt, setIsLoading);
        setSummarizedNote(summary);
    };

    // --- Task Management Functions ---
    const handleAddTask = async () => {
        if (!taskInput.trim() || !db || !userId) {
            console.log("Task input is empty or Firebase not ready.");
            return;
        }
        try {
            await addDoc(collection(db, `artifacts/${__app_id}/users/${userId}/tasks`), {
                text: taskInput,
                completed: false,
                createdAt: new Date().toISOString()
            });
            setTaskInput('');
        } catch (e) {
            console.error("Error adding document: ", e);
        }
    };

    const handleToggleTask = async (id, currentCompleted) => {
        if (!db || !userId) {
            console.log("Firebase not ready for toggle task.");
            return;
        }
        try {
            const taskDocRef = doc(db, `artifacts/${__app_id}/users/${userId}/tasks`, id);
            await updateDoc(taskDocRef, { completed: !currentCompleted });
        } catch (e) {
            console.error("Error updating document: ", e);
        }
    };

    const handleDeleteTask = async (id) => {
        if (!db || !userId) {
            console.log("Firebase not ready for delete task.");
            return;
        }
        try {
            const taskDocRef = doc(db, `artifacts/${__app_id}/users/${userId}/tasks`, id);
            await deleteDoc(taskDocRef);
        } catch (e) {
            console.error("Error deleting document: ", e);
        }
    };

    // --- Personalized Study Plan Functions ---
    const handleGenerateStudyPlan = async () => {
        if (!studyGoalInput.trim()) {
            setStudyPlanOutput("Please enter a study goal or topic to generate a plan.");
            return;
        }
        const prompt = `Generate a personalized study plan for the following goal/topic: "${studyGoalInput}". Include key areas, recommended resources (general types, not specific links), and a suggested timeline. Make it structured and actionable.`;
        const plan = await callGeminiAPI(prompt, setIsLoading);
        setStudyPlanOutput(plan);
    };

    // --- Flashcards/Quiz Functions ---
    const handleGenerateQuiz = async () => {
        if (!quizInput.trim()) {
            setQuizOutput("Please provide some text to generate a quiz/flashcards from.");
            return;
        }
        const prompt = `Based on the following text, generate 3-5 distinct question-answer pairs suitable for flashcards or a short quiz. Format each pair as "Q: [Question]\nA: [Answer]".\n\nText: "${quizInput}"`;
        const generatedContent = await callGeminiAPI(prompt, setIsQuizLoading);
        setQuizOutput(generatedContent);
    };

    // --- AI Explanation Functions ---
    const handleGetExplanation = async () => {
        if (!explanationQuestion.trim()) {
            setExplanationAnswer("Please ask a question to get an explanation.");
            return;
        }
        const prompt = `Provide a clear and concise explanation for the following question/concept: "${explanationQuestion}"`;
        const explanation = await callGeminiAPI(prompt, setIsExplanationLoading);
        setExplanationAnswer(explanation);
    };


    // --- Pomodoro Timer Functions ---
    useEffect(() => {
        if (isActive) {
            timerRef.current = setInterval(() => {
                setTimerSeconds((prevSeconds) => {
                    if (prevSeconds === 0) {
                        if (timerMinutes === 0) {
                            clearInterval(timerRef.current);
                            setIsActive(false);
                            // Session complete, switch to break or next pomodoro
                            if (isBreak) {
                                // Break finished, start next pomodoro
                                setCurrentSessionType('Pomodoro');
                                setIsBreak(false);
                                setTimerMinutes(25);
                                setTimerSeconds(0);
                            } else {
                                // Pomodoro finished, start a short break
                                setCurrentSessionType('Short Break');
                                setIsBreak(true);
                                setTimerMinutes(5);
                                setTimerSeconds(0);
                            }
                            // Optionally, play a sound or show a notification here
                            return 0;
                        }
                        setTimerMinutes((prevMinutes) => prevMinutes - 1);
                        return 59;
                    }
                    return prevSeconds - 1;
                });
            }, 1000);
        } else if (!isActive && timerRef.current) {
            clearInterval(timerRef.current);
        }

        return () => clearInterval(timerRef.current);
    }, [isActive, timerMinutes, timerSeconds, isBreak]);

    const startTimer = () => {
        setIsActive(true);
    };

    const pauseTimer = () => {
        setIsActive(false);
    };

    const resetTimer = () => {
        clearInterval(timerRef.current);
        setIsActive(false);
        setIsBreak(false);
        setCurrentSessionType('Pomodoro');
        setTimerMinutes(25);
        setTimerSeconds(0);
    };

    const formatTime = (minutes, seconds) => {
        return `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-100 to-indigo-100 font-inter text-gray-800 p-4 md:p-8">
            <script src="https://cdn.tailwindcss.com"></script>
            {/* KaTeX CSS and JS */}
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css" xintegrity="sha384-wcIxkf4UmgaL2PMg8K4eH7bdptKvaTNbYGg/KOyLCNvc5FBo8Wc/fxgf9boFxcMh" crossOrigin="anonymous" />
            <script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js" xintegrity="sha384-h0Lk9h3yW59pmjC/YgG8g34cK9k0x3G+B79JdE6b1H1O2uK12sP7G9+W4/Y5wA1" crossOrigin="anonymous"></script>
            <script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js" xintegrity="sha384-yFIayB+kP4/x9Q32+i/RxBSRY/gD/cI3k4/jP+F3p5N5P5zP3o3" crossOrigin="anonymous"></script>
            <style>
                {`
                body { font-family: 'Inter', sans-serif; }
                /* Custom scrollbar for better aesthetics */
                ::-webkit-scrollbar {
                    width: 8px;
                }
                ::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 10px;
                }
                ::-webkit-scrollbar-thumb {
                    background: #888;
                    border-radius: 10px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: #555;
                }
                /* KaTeX specific styling if needed */
                .katex-display {
                    overflow-x: auto; /* Allow horizontal scrolling for wide equations */
                    padding: 0.5em 0;
                }
                `}
            </style>

            <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-6 md:p-10">
                <h1 className="text-4xl font-bold text-center text-purple-700 mb-8">AI Study Assistant</h1>

                {/* Display User ID for debugging/sharing in multi-user context */}
                {userId && (
                    <div className="mb-6 p-4 bg-purple-50 rounded-lg shadow-inner text-sm text-purple-800">
                        <p className="font-semibold mb-1">Your User ID (for data persistence):</p>
                        <p className="break-all">{userId}</p>
                    </div>
                )}

                {/* Global Loading Indicator */}
                {(isLoading || isQuizLoading || isExplanationLoading || isDailyTipLoading) && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white p-4 rounded-xl shadow-lg flex items-center space-x-3">
                            <svg className="animate-spin h-5 w-5 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-gray-700">AI is thinking...</span>
                        </div>
                    </div>
                )}

                {/* Daily Study Quote/Tip Section */}
                <section className="mb-10 p-6 bg-white rounded-xl shadow-md border border-teal-200">
                    <h2 className="text-2xl font-semibold text-teal-600 mb-4">🌟 Daily Study Insight</h2>
                    {isDailyTipLoading ? (
                        <p className="text-gray-500">Generating daily tip...</p>
                    ) : (
                        <p className="text-lg text-teal-800 italic text-center">
                            {renderTextWithLatex(dailyTip)}
                        </p>
                    )}
                </section>


                {/* Note-taking Section */}
                <section className="mb-10 p-6 bg-white rounded-xl shadow-md border border-purple-200">
                    <h2 className="text-2xl font-semibold text-purple-600 mb-4">📝 Note-taking</h2>
                    <textarea
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-400 focus:border-transparent transition duration-200 resize-y h-32"
                        placeholder="Type or paste your notes here..."
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                    ></textarea>
                    <button
                        onClick={handleSummarizeNote}
                        className="mt-3 px-6 py-3 bg-purple-500 text-white font-semibold rounded-lg shadow-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 transition duration-200 ease-in-out transform hover:-translate-y-0.5 hover:scale-105"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Summarizing...' : 'Summarize Notes'}
                    </button>
                    {summarizedNote && (
                        <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200 text-purple-800">
                            <h3 className="font-semibold mb-2">AI Summary:</h3>
                            {renderTextWithLatex(summarizedNote)}
                        </div>
                    )}
                </section>

                {/* Task Management Section */}
                <section className="mb-10 p-6 bg-white rounded-xl shadow-md border border-indigo-200">
                    <h2 className="text-2xl font-semibold text-indigo-600 mb-4">✅ Task Management</h2>
                    <div className="flex gap-3 mb-4">
                        <input
                            type="text"
                            className="flex-grow p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition duration-200"
                            placeholder="Add a new task..."
                            value={taskInput}
                            onChange={(e) => setTaskInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                        />
                        <button
                            onClick={handleAddTask}
                            className="px-6 py-3 bg-indigo-500 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 transition duration-200 ease-in-out transform hover:-translate-y-0.5 hover:scale-105"
                        >
                            Add Task
                        </button>
                    </div>
                    {tasks.length === 0 ? (
                        <p className="text-gray-500">No tasks added yet. Start by adding one above!</p>
                    ) : (
                        <ul className="space-y-3">
                            {tasks.map((task) => (
                                <li key={task.id} className="flex items-center justify-between p-3 bg-indigo-50 rounded-md shadow-sm border border-indigo-200">
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={task.completed}
                                            onChange={() => handleToggleTask(task.id, task.completed)}
                                            className="form-checkbox h-5 w-5 text-indigo-600 rounded focus:ring-indigo-500 mr-3 cursor-pointer"
                                        />
                                        <span className={`text-lg ${task.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                                            {task.text}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteTask(task.id)}
                                        className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 transition duration-200"
                                        aria-label="Delete task"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm2 3a1 1 0 011-1h4a1 1 0 110 2H10a1 1 0 01-1-1zm-2 3a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {/* Personalized Study Plan Section */}
                <section className="mb-10 p-6 bg-white rounded-xl shadow-md border border-green-200">
                    <h2 className="text-2xl font-semibold text-green-600 mb-4">✨ Personalized Study Plan</h2>
                    <textarea
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-400 focus:border-transparent transition duration-200 resize-y h-28"
                        placeholder="What are your study goals or topics? (e.g., 'Learn React hooks and context API', 'Prepare for a calculus exam')"
                        value={studyGoalInput}
                        onChange={(e) => setStudyGoalInput(e.target.value)}
                    ></textarea>
                    <button
                        onClick={handleGenerateStudyPlan}
                        className="mt-3 px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 transition duration-200 ease-in-out transform hover:-translate-y-0.5 hover:scale-105"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Generating...' : 'Generate Study Plan'}
                    </button>
                    {studyPlanOutput && (
                        <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200 text-green-800">
                            <h3 className="font-semibold mb-2">AI-Generated Study Plan:</h3>
                            {renderTextWithLatex(studyPlanOutput)}
                        </div>
                    )}
                </section>

                {/* Flashcards / Quiz Generation Section */}
                <section className="mb-10 p-6 bg-white rounded-xl shadow-md border border-pink-200">
                    <h2 className="text-2xl font-semibold text-pink-600 mb-4">🧠 Flashcards / Quiz Generator</h2>
                    <textarea
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-400 focus:border-transparent transition duration-200 resize-y h-32"
                        placeholder="Paste text here to generate flashcards or quiz questions. (e.g., your notes from a lecture, a paragraph from a textbook)"
                        value={quizInput}
                        onChange={(e) => setQuizInput(e.target.value)}
                    ></textarea>
                    <button
                        onClick={handleGenerateQuiz}
                        className="mt-3 px-6 py-3 bg-pink-500 text-white font-semibold rounded-lg shadow-md hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2 transition duration-200 ease-in-out transform hover:-translate-y-0.5 hover:scale-105"
                        disabled={isQuizLoading}
                    >
                        {isQuizLoading ? 'Generating...' : 'Generate Flashcards/Quiz'}
                    </button>
                    {quizOutput && (
                        <div className="mt-6 p-4 bg-pink-50 rounded-lg border border-pink-200 text-pink-800 whitespace-pre-wrap">
                            <h3 className="font-semibold mb-2">AI-Generated Content:</h3>
                            {renderTextWithLatex(quizOutput)}
                        </div>
                    )}
                </section>

                {/* AI Explanation Section */}
                <section className="mb-10 p-6 bg-white rounded-xl shadow-md border border-blue-200">
                    <h2 className="text-2xl font-semibold text-blue-600 mb-4">❓ AI Explanations</h2>
                    <textarea
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-transparent transition duration-200 resize-y h-28"
                        placeholder="Ask a question or a concept you need explained (e.g., 'What is recursion?', 'Explain the concept of quantum entanglement')."
                        value={explanationQuestion}
                        onChange={(e) => setExplanationQuestion(e.target.value)}
                    ></textarea>
                    <button
                        onClick={handleGetExplanation}
                        className="mt-3 px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition duration-200 ease-in-out transform hover:-translate-y-0.5 hover:scale-105"
                        disabled={isExplanationLoading}
                    >
                        {isExplanationLoading ? 'Explaining...' : 'Get Explanation'}
                    </button>
                    {explanationAnswer && (
                        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200 text-blue-800">
                            <h3 className="font-semibold mb-2">AI's Explanation:</h3>
                            {renderTextWithLatex(explanationAnswer)}
                        </div>
                    )}
                </section>

                {/* Pomodoro Timer Section */}
                <section className="p-6 bg-white rounded-xl shadow-md border border-yellow-200">
                    <h2 className="text-2xl font-semibold text-yellow-600 mb-4">⏳ Pomodoro Timer</h2>
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="text-6xl font-bold text-yellow-700">
                            {formatTime(timerMinutes, timerSeconds)}
                        </div>
                        <div className="text-xl font-medium text-yellow-800">
                            {currentSessionType}
                        </div>
                        <div className="flex space-x-4">
                            <button
                                onClick={startTimer}
                                className="px-6 py-3 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 transition duration-200 ease-in-out transform hover:-translate-y-0.5 hover:scale-105"
                                disabled={isActive}
                            >
                                Start
                            </button>
                            <button
                                onClick={pauseTimer}
                                className="px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition duration-200 ease-in-out transform hover:-translate-y-0.5 hover:scale-105"
                                disabled={!isActive}
                            >
                                Pause
                            </button>
                            <button
                                onClick={resetTimer}
                                className="px-6 py-3 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 transition duration-200 ease-in-out transform hover:-translate-y-0.5 hover:scale-105"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default App;
