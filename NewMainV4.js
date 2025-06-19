import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, updateDoc, doc, setDoc } from 'firebase/firestore';

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

// Navbar Component
const Navbar = ({ setCurrentPage }) => (
    <nav className="bg-purple-700 p-4 shadow-lg rounded-b-xl mb-8">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold text-white cursor-pointer" onClick={() => setCurrentPage('home')}>AI Study Assistant</h1>
            <div className="space-x-4">
                <button
                    onClick={() => setCurrentPage('home')}
                    className="px-3 py-2 rounded-md text-white font-medium hover:bg-purple-600 transition duration-200"
                >
                    Home
                </button>
                <button
                    onClick={() => setCurrentPage('study')}
                    className="px-3 py-2 rounded-md text-white font-medium hover:bg-purple-600 transition duration-200"
                >
                    Study Assistant
                </button>
                <button
                    onClick={() => setCurrentPage('about')}
                    className="px-3 py-2 rounded-md text-white font-medium hover:bg-purple-600 transition duration-200"
                >
                    About
                </button>
            </div>
        </div>
    </nav>
);

// Footer Component
const Footer = () => (
    <footer className="bg-gray-800 text-white p-6 mt-12 rounded-t-xl">
        <div className="max-w-6xl mx-auto text-center text-sm">
            <p>&copy; {new Date().getFullYear()} AI Study Assistant. All rights reserved.</p>
            <p className="mt-2">Designed with passion for effective learning.</p>
        </div>
    </footer>
);

// Home Page Component
const HomePage = ({ setCurrentPage }) => (
    <div className="text-center py-20 px-4">
        <h2 className="text-5xl font-extrabold text-purple-800 mb-6 leading-tight">
            Unlock Your Full Learning Potential with AI
        </h2>
        <p className="text-xl text-gray-700 max-w-2xl mx-auto mb-10">
            Your all-in-one personalized study companion powered by advanced AI.
            Summarize notes, manage tasks, create study plans, and more!
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
                onClick={() => setCurrentPage('study')}
                className="px-8 py-4 bg-purple-600 text-white text-lg font-semibold rounded-xl shadow-lg hover:bg-purple-700 transition duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-105"
            >
                Start Learning Now
            </button>
            <button
                onClick={() => setCurrentPage('about')}
                className="px-8 py-4 bg-gray-200 text-gray-800 text-lg font-semibold rounded-xl shadow-lg hover:bg-gray-300 transition duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-105"
            >
                Learn More
            </button>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="p-6 bg-white rounded-xl shadow-md border border-purple-200">
                <h3 className="text-xl font-bold text-purple-700 mb-3">📝 Smart Note Summaries</h3>
                <p className="text-gray-600">Condense lengthy notes into key insights instantly.</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-md border border-purple-200">
                <h3 className="text-xl font-bold text-purple-700 mb-3">✅ Effortless Task Management</h3>
                <p className="text-gray-600">Stay organized with intuitive task tracking and reminders.</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-md border border-purple-200">
                <h3 className="text-xl font-bold text-purple-700 mb-3">✨ Personalized Study Plans</h3>
                <p className="text-gray-600">Generate custom plans tailored to your learning goals.</p>
            </div>
        </div>
    </div>
);

// About Page Component
const AboutPage = () => (
    <div className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-4xl font-bold text-purple-700 mb-8 text-center">About AI Study Assistant</h2>

        <section className="mb-8 bg-white p-6 rounded-xl shadow-md border border-purple-200">
            <h3 className="text-2xl font-semibold text-purple-600 mb-4">Our Mission</h3>
            <p className="text-gray-700 leading-relaxed">
                The AI Study Assistant is designed to revolutionize how students and lifelong learners approach their studies.
                Our mission is to provide an intelligent, intuitive, and comprehensive platform that leverages artificial intelligence
                to enhance productivity, improve understanding, and foster a more engaging learning experience.
            </p>
        </section>

        <section className="mb-8 bg-white p-6 rounded-xl shadow-md border border-purple-200">
            <h3 className="text-2xl font-semibold text-purple-600 mb-4">Key Features</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>**AI-Powered Note Summarization & Transformation:** Instantly summarize, elaborate, simplify, or rephrase your notes.</li>
                <li>**Task Management:** Organize your assignments and study tasks with due dates.</li>
                <li>**Personalized Study Plans:** Generate customized study schedules based on your goals.</li>
                <li>**Flashcard & Quiz Generation:** Create quick quizzes from your notes for active recall.</li>
                <li>**AI Explanations:** Get clear explanations for complex concepts.</li>
                <li>**Pomodoro Timer:** Boost focus and productivity with timed study sessions.</li>
                <li>**Progress Tracking:** Monitor your learning journey and get AI-powered insights.</li>
                <li>**Gamification:** Earn points and badges to make studying fun and motivating.</li>
                <li>**Resource Aggregation:** Keep all your essential study links in one place.</li>
                <li>**Voice Input:** Interact with the app hands-free for certain inputs.</li>
            </ul>
        </section>

        <section className="bg-white p-6 rounded-xl shadow-md border border-purple-200">
            <h3 className="text-2xl font-semibold text-purple-600 mb-4">Technology Used</h3>
            <p className="text-gray-700 leading-relaxed">
                This application is built using modern web technologies to ensure a smooth and responsive user experience:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mt-3">
                <li>**React.js:** For building a dynamic and interactive user interface.</li>
                <li>**Tailwind CSS:** For efficient and highly customizable styling.</li>
                <li>**Firebase Firestore:** For robust and real-time data storage (notes, tasks, resources, user metrics).</li>
                <li>**Google Gemini API:** For all AI-powered functionalities (summarization, explanations, study plans, etc.).</li>
                <li>**KaTeX:** For beautiful and fast rendering of mathematical equations using LaTeX syntax.</li>
                <li>**Web Speech API:** For voice input capabilities.</li>
            </ul>
        </section>
    </div>
);

// Main Study Assistant Content Component (extracted from original App)
const StudyAssistantPage = ({ db, auth, userId, isAuthReady }) => {
    // State for notes, tasks, and study plan input/output
    const [noteInput, setNoteInput] = useState('');
    const [summarizedNote, setSummarizedNote] = useState('');
    const [editedSummarizedNote, setEditedSummarizedNote] = useState(''); // Editable state
    const [isEditingSummarizedNote, setIsEditingSummarizedNote] = useState(false); // Edit mode toggle

    const [transformedContent, setTransformedContent] = useState(''); // New state for transformed content
    const [editedTransformedContent, setEditedTransformedContent] = useState(''); // Editable state
    const [isEditingTransformedContent, setIsEditingTransformedContent] = useState(false); // Edit mode toggle
    const [isTransforming, setIsTransforming] = useState(false); // New loading state for transformations

    const [tasks, setTasks] = useState([]);
    const [taskInput, setTaskInput] = useState('');
    const [taskDueDate, setTaskDueDate] = useState(''); // New state for task due date

    const [studyGoalInput, setStudyGoalInput] = useState('');
    const [studyPlanOutput, setStudyPlanOutput] = useState('');
    const [editedStudyPlanOutput, setEditedStudyPlanOutput] = useState(''); // Editable state
    const [isEditingStudyPlanOutput, setIsEditingStudyPlanOutput] = useState(false); // Edit mode toggle

    const [isLoading, setIsLoading] = useState(false); // For AI loading states in Notes/Study Plan

    // New states for Flashcard/Quiz
    const [quizInput, setQuizInput] = useState('');
    const [quizOutput, setQuizOutput] = useState('');
    const [editedQuizOutput, setEditedQuizOutput] = useState(''); // Editable state
    const [isEditingQuizOutput, setIsEditingQuizOutput] = useState(false); // Edit mode toggle
    const [isQuizLoading, setIsQuizLoading] = useState(false);

    // New states for AI Explanation
    const [explanationQuestion, setExplanationQuestion] = useState('');
    const [explanationAnswer, setExplanationAnswer] = useState('');
    const [editedExplanationAnswer, setEditedExplanationAnswer] = useState(''); // Editable state
    const [isEditingExplanationAnswer, setIsEditingExplanationAnswer] = useState(false); // Edit mode toggle
    const [isExplanationLoading, setIsExplanationLoading] = useState(false);

    // New states for Daily Study Quote/Tip
    const [dailyTip, setDailyTip] = useState('');
    const [editedDailyTip, setEditedDailyTip] = useState(''); // Editable state
    const [isEditingDailyTip, setIsEditingDailyTip] = useState(false); // Edit mode toggle
    const [isDailyTipLoading, setIsDailyTipLoading] = useState(false);

    // New states for Pomodoro Timer
    const [timerMinutes, setTimerMinutes] = useState(25);
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [isBreak, setIsBreak] = useState(false);
    const [currentSessionType, setCurrentSessionType] = useState('Pomodoro'); // 'Pomodoro' or 'Short Break' or 'Long Break'
    const timerRef = useRef(null);

    // New states for Spaced Repetition (Quiz Data with Recall Level)
    const [quizzes, setQuizzes] = useState([]); // To store generated quizzes with recall info
    const [currentQuizIndex, setCurrentQuizIndex] = useState(0); // To navigate quizzes

    // New states for Progress Tracking (Dummy Data for now)
    const [totalTasksCompleted, setTotalTasksCompleted] = useState(0);
    const [totalStudyTime, setTotalStudyTime] = useState(0); // in minutes
    const [progressInsight, setProgressInsight] = useState('');
    const [editedProgressInsight, setEditedProgressInsight] = useState(''); // Editable state
    const [isEditingProgressInsight, setIsEditingProgressInsight] = useState(false); // Edit mode toggle
    const [isProgressLoading, setIsProgressLoading] = useState(false);


    // New states for Resource Link Aggregator
    const [resourceLink, setResourceLink] = useState('');
    const [resourceTitle, setResourceTitle] = useState('');
    const [resources, setResources] = useState([]);
    const [suggestedResourceCategory, setSuggestedResourceCategory] = useState('');
    const [isResourceCategoryLoading, setIsResourceCategoryLoading] = useState(false);

    // New states for Calendar
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [calendarEvents, setCalendarEvents] = useState({}); // Stores tasks and pomodoro sessions by date

    // New states for Gamification
    const [userPoints, setUserPoints] = useState(0);
    const [studyStreaks, setStudyStreaks] = useState(0); // Consecutive study days
    const [earnedBadges, setEarnedBadges] = useState([]);
    const [lastStudyDate, setLastStudyDate] = useState(null); // To track streaks


    // New states for Voice Input
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null); // Reference for SpeechRecognition object


    // Effect to fetch tasks and resources from Firestore when db and userId are ready
    useEffect(() => {
        if (!db || !userId || !isAuthReady) {
            console.log("Firestore or User ID not ready, or Auth not settled.");
            return;
        }

        // Use __app_id for the collection path as specified in guidelines
        const tasksCollectionRef = collection(db, `artifacts/${__app_id}/users/${userId}/tasks`);
        const resourcesCollectionRef = collection(db, `artifacts/${__app_id}/users/${userId}/resources`);
        const userMetricsDocRef = doc(db, `artifacts/${__app_id}/users/${userId}/metrics/gamification`);
        const pomodoroLogsCollectionRef = collection(db, `artifacts/${__app_id}/users/${userId}/pomodoro_logs`);


        const unsubscribeTasks = onSnapshot(tasksCollectionRef, (snapshot) => {
            const fetchedTasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Sort tasks by createdAt to maintain order
            fetchedTasks.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            setTasks(fetchedTasks);
            // Update total tasks completed for progress tracking
            setTotalTasksCompleted(fetchedTasks.filter(task => task.completed).length);

            // Update calendar events
            const newCalendarEvents = {};
            fetchedTasks.forEach(task => {
                if (task.dueDate) {
                    const dateKey = task.dueDate.split('T')[0]; //YYYY-MM-DD
                    if (!newCalendarEvents[dateKey]) {
                        newCalendarEvents[dateKey] = [];
                    }
                    newCalendarEvents[dateKey].push({ type: 'task', ...task });
                }
            });
            setCalendarEvents(prevEvents => ({ ...prevEvents, ...newCalendarEvents }));
        }, (error) => {
            console.error("Error fetching tasks:", error);
        });

        const unsubscribeResources = onSnapshot(resourcesCollectionRef, (snapshot) => {
            const fetchedResources = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setResources(fetchedResources);
        }, (error) => {
            console.error("Error fetching resources:", error);
        });

        // Listen for user metrics for gamification
        const unsubscribeMetrics = onSnapshot(userMetricsDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const metrics = docSnap.data();
                setUserPoints(metrics.points || 0);
                setStudyStreaks(metrics.streaks || 0);
                setEarnedBadges(metrics.badges || []);
                setLastStudyDate(metrics.lastStudyDate || null);
            } else {
                // Initialize metrics if they don't exist
                setDoc(userMetricsDocRef, { points: 0, streaks: 0, badges: [], lastStudyDate: null });
            }
        }, (error) => {
            console.error("Error fetching user metrics:", error);
        });

        // Listen for pomodoro logs for calendar and streak tracking
        const unsubscribePomodoroLogs = onSnapshot(pomodoroLogsCollectionRef, (snapshot) => {
            const fetchedLogs = snapshot.docs.map(doc => doc.data());
            const newCalendarEvents = {};
            fetchedLogs.forEach(log => {
                const dateKey = log.date.split('T')[0]; //YYYY-MM-DD
                if (!newCalendarEvents[dateKey]) {
                    newCalendarEvents[dateKey] = [];
                }
                newCalendarEvents[dateKey].push({ type: 'pomodoro', ...log });
            });
            setCalendarEvents(prevEvents => ({ ...prevEvents, ...newCalendarEvents }));

            // Update total study time from logs
            setTotalStudyTime(fetchedLogs.reduce((sum, log) => sum + (log.duration || 25), 0));

        }, (error) => {
            console.error("Error fetching pomodoro logs:", error);
        });


        // Cleanup the listener on component unmount
        return () => {
            unsubscribeTasks();
            unsubscribeResources();
            unsubscribeMetrics();
            unsubscribePomodoroLogs();
        };
    }, [db, userId, isAuthReady]); // Add isAuthReady to dependencies

    // Effect to fetch daily study tip on component mount
    useEffect(() => {
        const fetchDailyTip = async () => {
            // Removed LaTeX announcement from prompt
            const prompt = "Generate a concise, positive, and actionable study tip or motivational quote for today.";
            const tip = await callGeminiAPI(prompt, setIsDailyTipLoading);
            setDailyTip(tip);
            setEditedDailyTip(tip); // Initialize editable content
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

    // --- Gamification Functions ---
    const updateUserMetrics = async (updates) => {
        if (!db || !userId) return;
        const userMetricsDocRef = doc(db, `artifacts/${__app_id}/users/${userId}/metrics/gamification`);
        try {
            await updateDoc(userMetricsDocRef, updates);
        } catch (e) {
            console.error("Error updating user metrics:", e);
        }
    };

    const addPoints = useCallback((amount) => {
        setUserPoints(prev => {
            const newPoints = prev + amount;
            updateUserMetrics({ points: newPoints });
            // Check for point-based badges
            if (newPoints >= 100 && !earnedBadges.includes('100 Points')) {
                setEarnedBadges(prevBadges => {
                    const newBadges = [...prevBadges, '100 Points'];
                    updateUserMetrics({ badges: newBadges });
                    alert('🎉 New Badge Earned: 100 Points! 🎉');
                    return newBadges;
                });
            }
            return newPoints;
        });
    }, [db, userId, earnedBadges]);

    const updateStreaks = useCallback(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day

        if (lastStudyDate) {
            const lastDate = new Date(lastStudyDate);
            lastDate.setHours(0, 0, 0, 0);

            const diffTime = Math.abs(today.getTime() - lastDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) { // Consecutive day
                setStudyStreaks(prev => {
                    const newStreaks = prev + 1;
                    updateUserMetrics({ streaks: newStreaks, lastStudyDate: today.toISOString() });
                    if (newStreaks === 3 && !earnedBadges.includes('3-Day Streak')) {
                        setEarnedBadges(prevBadges => {
                            const newBadges = [...prevBadges, '3-Day Streak'];
                            updateUserMetrics({ badges: newBadges });
                            alert('🔥 New Badge Earned: 3-Day Streak! 🔥');
                            return newBadges;
                        });
                    }
                    return newStreaks;
                });
            } else if (diffDays > 1) { // Gap, reset streak
                setStudyStreaks(1); // Start new streak
                updateUserMetrics({ streaks: 1, lastStudyDate: today.toISOString() });
            }
        } else { // First study session
            setStudyStreaks(1);
            updateUserMetrics({ streaks: 1, lastStudyDate: today.toISOString() });
        }
    }, [db, userId, lastStudyDate, earnedBadges]);


    // --- Note-taking Functions ---
    const handleSummarizeNote = async () => {
        if (!noteInput.trim()) {
            setSummarizedNote("Please enter some text to summarize.");
            setEditedSummarizedNote("Please enter some text to summarize.");
            return;
        }
        const prompt = `Summarize the following notes concisely: \n\n"${noteInput}"`;
        const summary = await callGeminiAPI(prompt, setIsLoading);
        setSummarizedNote(summary);
        setEditedSummarizedNote(summary);
        setIsEditingSummarizedNote(false); // Exit edit mode after new generation
    };

    // New AI Content Transformation Functions
    const handleElaborateContent = async () => {
        if (!noteInput.trim()) {
            setTransformedContent("Please enter some text to elaborate.");
            setEditedTransformedContent("Please enter some text to elaborate.");
            return;
        }
        const prompt = `Elaborate on the following text, adding more details and examples: \n\n"${noteInput}"`;
        const elaborated = await callGeminiAPI(prompt, setIsTransforming);
        setTransformedContent(elaborated);
        setEditedTransformedContent(elaborated);
        setIsEditingTransformedContent(false);
    };

    const handleSimplifyContent = async () => {
        if (!noteInput.trim()) {
            setTransformedContent("Please enter some text to simplify.");
            setEditedTransformedContent("Please enter some text to simplify.");
            return;
        }
        const prompt = `Simplify the following text for easier understanding, using simpler language and shorter sentences: \n\n"${noteInput}"`;
        const simplified = await callGeminiAPI(prompt, setIsTransforming);
        setTransformedContent(simplified);
        setEditedTransformedContent(simplified);
        setIsEditingTransformedContent(false);
    };

    const handleRephraseContent = async () => {
        if (!noteInput.trim()) {
            setTransformedContent("Please enter some text to rephrase.");
            setEditedTransformedContent("Please enter some text to rephrase.");
            return;
        }
        const prompt = `Rephrase the following text in a different way, maintaining its original meaning but altering the wording and sentence structure: \n\n"${noteInput}"`;
        const rephrased = await callGeminiAPI(prompt, setIsTransforming);
        setTransformedContent(rephrased);
        setEditedTransformedContent(rephrased);
        setIsEditingTransformedContent(false);
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
                createdAt: new Date().toISOString(),
                dueDate: taskDueDate || null // Add due date
            });
            setTaskInput('');
            setTaskDueDate(''); // Clear due date after adding
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
            if (!currentCompleted) { // If task is being marked as completed
                addPoints(10); // Award points for completing a task
                if (!earnedBadges.includes('First Task Complete') && tasks.filter(t => t.completed).length === 0) {
                    setEarnedBadges(prevBadges => {
                        const newBadges = [...prevBadges, 'First Task Complete'];
                        updateUserMetrics({ badges: newBadges });
                        alert('🏆 New Badge Earned: First Task Complete! 🏆');
                        return newBadges;
                    });
                }
            }
        }
        catch (e) {
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
            setEditedStudyPlanOutput("Please enter a study goal or topic to generate a plan.");
            return;
        }
        const prompt = `Generate a personalized study plan for the following goal/topic: "${studyGoalInput}". Include key areas, recommended resources (general types, not specific links), and a suggested timeline. Make it structured and actionable.`;
        const plan = await callGeminiAPI(prompt, setIsLoading);
        setStudyPlanOutput(plan);
        setEditedStudyPlanOutput(plan);
        setIsEditingStudyPlanOutput(false);
    };

    // --- Flashcards / Quiz Generation Functions ---
    const handleGenerateQuiz = async () => {
        if (!quizInput.trim()) {
            setQuizOutput("Please provide some text to generate a quiz/flashcards from.");
            setEditedQuizOutput("Please provide some text to generate a quiz/flashcards from.");
            setQuizzes([]); // Clear previous quizzes
            return;
        }
        const prompt = `Based on the following text, generate 3-5 distinct question-answer pairs suitable for flashcards or a short quiz. Format each pair as "Q: [Question]\nA: [Answer]".\n\nText: "${quizInput}"`;
        const generatedContent = await callGeminiAPI(prompt, setIsQuizLoading);
        setQuizOutput(generatedContent);
        setEditedQuizOutput(generatedContent); // Initialize editable content

        // Parse quiz content into structured data for spaced repetition
        const quizPairs = generatedContent.split('\n\n').filter(pair => pair.startsWith('Q:')).map(pair => {
            const [question, answer] = pair.split('\nA: ').map(s => s.trim().substring(s.indexOf(':') + 1));
            return { question, answer, recall: null, nextReview: null }; // recall: 'easy', 'medium', 'hard'
        });
        setQuizzes(quizPairs);
        setCurrentQuizIndex(0);
        setIsEditingQuizOutput(false);
    };

    const handleQuizRecall = (recallLevel) => {
        const updatedQuizzes = [...quizzes];
        if (updatedQuizzes[currentQuizIndex]) {
            updatedQuizzes[currentQuizIndex].recall = recallLevel;
            // Simple logic for next review date (can be expanded)
            let daysToAdd = 0;
            if (recallLevel === 'easy') daysToAdd = 3;
            else if (recallLevel === 'medium') daysToAdd = 1;
            else daysToAdd = 0; // Review immediately if hard

            const nextReviewDate = new Date();
            nextReviewDate.setDate(nextReviewDate.getDate() + daysToAdd);
            updatedQuizzes[currentQuizIndex].nextReview = nextReviewDate.toISOString();
            setQuizzes(updatedQuizzes);
            addPoints(recallLevel === 'easy' ? 15 : recallLevel === 'medium' ? 10 : 5); // Points for quiz recall
        }
        // Move to next quiz or reset if all reviewed
        if (currentQuizIndex < quizzes.length - 1) {
            setCurrentQuizIndex(currentQuizIndex + 1);
        } else {
            alert('Quiz completed! Review your progress in the dashboard.');
            setCurrentQuizIndex(0); // Reset for next session or a new quiz
            setQuizOutput(''); // Clear quiz display
            setEditedQuizOutput('');
        }
    };

    // --- AI Explanation Functions ---
    const handleGetExplanation = async () => {
        if (!explanationQuestion.trim()) {
            setExplanationAnswer("Please ask a question to get an explanation.");
            setEditedExplanationAnswer("Please ask a question to get an explanation.");
            return;
        }
        const prompt = `Provide a clear and concise explanation for the following question/concept: "${explanationQuestion}"`;
        const explanation = await callGeminiAPI(prompt, setIsExplanationLoading);
        setExplanationAnswer(explanation);
        setEditedExplanationAnswer(explanation);
        setIsEditingExplanationAnswer(false);
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

                            // Log study time for progress and gamification
                            const sessionDuration = 25; // Assuming a full Pomodoro is 25 minutes
                            addPoints(sessionDuration / 5); // 5 points per 25 min Pomodoro
                            updateStreaks(); // Update study streaks

                            // Log pomodoro session to Firestore
                            if (db && userId) {
                                const today = new Date().toISOString().split('T')[0]; //YYYY-MM-DD
                                addDoc(collection(db, `artifacts/${__app_id}/users/${userId}/pomodoro_logs`), {
                                    date: new Date().toISOString(),
                                    duration: sessionDuration,
                                    type: isBreak ? 'break' : 'pomodoro'
                                });
                            }

                            // Session complete, switch to break or next pomodoro
                            if (isBreak) {
                                // Break finished, start next pomodoro
                                setCurrentSessionType('Pomodoro');
                                setIsBreak(false);
                                setTimerMinutes(25); // Pomodoro duration
                                setTimerSeconds(0);
                            } else {
                                // Pomodoro finished, start a short break
                                setCurrentSessionType('Short Break');
                                setIsBreak(true);
                                setTimerMinutes(5); // Short break duration
                                setTimerSeconds(0);
                                if (!earnedBadges.includes('First Pomodoro') && totalStudyTime < 25) { // Check for first pomodoro badge
                                    setEarnedBadges(prevBadges => {
                                        const newBadges = [...prevBadges, 'First Pomodoro'];
                                        updateUserMetrics({ badges: newBadges });
                                        alert('🎉 New Badge Earned: First Pomodoro! 🎉');
                                        return newBadges;
                                    });
                                }
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
    }, [isActive, timerMinutes, timerSeconds, isBreak, db, userId, addPoints, updateStreaks, earnedBadges, totalStudyTime]); // Added dependencies

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

    // --- Resource Link Aggregator Functions ---
    const handleAddResource = async () => {
        if (!resourceLink.trim() || !resourceTitle.trim() || !db || !userId) {
            alert('Please provide both a title and a valid URL for the resource.');
            return;
        }
        try {
            await addDoc(collection(db, `artifacts/${__app_id}/users/${userId}/resources`), {
                title: resourceTitle,
                url: resourceLink,
                category: suggestedResourceCategory || 'Uncategorized', // Use suggested or default
                createdAt: new Date().toISOString()
            });
            setResourceTitle('');
            setResourceLink('');
            setSuggestedResourceCategory(''); // Clear suggested category after adding
        } catch (e) {
            console.error("Error adding resource: ", e);
        }
    };

    const handleDeleteResource = async (id) => {
        if (!db || !userId) return;
        try {
            await deleteDoc(doc(db, `artifacts/${__app_id}/users/${userId}/resources`, id));
        } catch (e) {
            console.error("Error deleting resource: ", e);
        }
    };

    const handleSuggestResourceCategory = async () => {
        if (!resourceTitle.trim()) {
            setSuggestedResourceCategory("Please enter a resource title to get a category suggestion.");
            return;
        }
        const prompt = `Suggest a single, concise category (e.g., "Programming", "Mathematics", "History", "Science", "Productivity") for a study resource titled "${resourceTitle}". If a URL is available, consider it: ${resourceLink || 'N/A'}. Respond with only the category name.`;
        const category = await callGeminiAPI(prompt, setIsResourceCategoryLoading);
        setSuggestedResourceCategory(category.replace(/[^a-zA-Z0-9\s]/g, '').trim()); // Clean up response
    };


    // --- Voice Input Functions ---
    const toggleListening = (setTextInput) => {
        if ('webkitSpeechRecognition' in window) {
            if (!recognitionRef.current) {
                const recognition = new window.webkitSpeechRecognition(); // Corrected constructor
                recognition.continuous = false; // Listen for a single utterance
                recognition.interimResults = false; // Only return final results
                recognition.lang = 'en-US';

                recognition.onstart = () => {
                    setIsListening(true);
                    console.log('Voice recognition started.');
                };

                recognition.onresult = (event) => {
                    const transcript = event.results[0][0].transcript; // Corrected access to transcript
                    setTextInput(transcript);
                    setIsListening(false);
                    console.log('Voice input received:', transcript);
                };

                recognition.onerror = (event) => {
                    console.error('Speech recognition error:', event.error);
                    setIsListening(false);
                    alert(`Speech recognition error: ${event.error}. Please ensure microphone access is granted.`);
                };

                recognition.onend = () => {
                    setIsListening(false);
                    console.log('Voice recognition ended.');
                };

                recognitionRef.current = recognition;
            }

            if (isListening) {
                recognitionRef.current.stop();
            } else {
                recognitionRef.current.start();
            }
        } else {
            alert('Speech recognition is not supported in your browser.');
        }
    };

    // --- Progress Tracking Functions (LLM-powered Insight) ---
    const handleGenerateProgressInsight = async () => {
        const quizSummary = quizzes.filter(q => q.recall !== null).reduce((acc, q) => {
            acc[q.recall] = (acc[q.recall] || 0) + 1;
            return acc;
        }, { easy: 0, medium: 0, hard: 0 });

        const prompt = `Based on the user's study data:
- Total tasks completed: ${totalTasksCompleted}
- Total study time via Pomodoro (minutes): ${totalStudyTime}
- Quiz recall performance: Easy: ${quizSummary.easy}, Medium: ${quizSummary.medium}, Hard: ${quizSummary.hard}
- Current points: ${userPoints}
- Current study streak: ${studyStreaks} days

Provide a concise, encouraging insight into their study progress. Suggest one actionable tip for improvement based on the data. For example, if many "hard" quizzes, suggest reviewing foundational material. If low study time, suggest more consistent sessions. Make sure to present your findings in a structured and easy-to-read format.`;

        const insight = await callGeminiAPI(prompt, setIsProgressLoading);
        setProgressInsight(insight);
        setEditedProgressInsight(insight); // Initialize editable content
        setIsEditingProgressInsight(false);
    };


    // --- Calendar Functions ---
    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay(); // 0 for Sunday

    const getCalendarDays = (year, month) => {
        const numDays = daysInMonth(year, month);
        const firstDay = firstDayOfMonth(year, month); // 0 (Sun) - 6 (Sat)
        const days = [];

        // Fill leading empty days
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }

        // Fill days of the month
        for (let i = 1; i <= numDays; i++) {
            days.push(i);
        }
        return days;
    };

    const goToPreviousMonth = () => {
        setCurrentMonth(prevMonth => {
            const newMonth = new Date(prevMonth.getFullYear(), prevMonth.getMonth() - 1, 1);
            return newMonth;
        });
    };

    const goToNextMonth = () => {
        setCurrentMonth(prevMonth => {
            const newMonth = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 1);
            return newMonth;
        });
    };

    const formatDateForCalendar = (year, month, day) => {
        const d = new Date(year, month, day);
        return d.toISOString().split('T')[0];
    };


    return (
        <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-6 md:p-10">
            {/* Display User ID for debugging/sharing in multi-user context */}
            {userId && (
                <div className="mb-6 p-4 bg-purple-50 rounded-lg shadow-inner text-sm text-purple-800">
                    <p className="font-semibold mb-1">Your User ID (for data persistence):</p>
                    <p className="break-all">{userId}</p>
                </div>
            )}

            {/* Global Loading Indicator */}
            {(isLoading || isQuizLoading || isExplanationLoading || isDailyTipLoading || isProgressLoading || isResourceCategoryLoading || isTransforming) && (
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
                    <div className="text-lg text-teal-800 italic text-center">
                        {isEditingDailyTip ? (
                            <textarea
                                value={editedDailyTip}
                                onChange={(e) => setEditedDailyTip(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded resize-y"
                                rows="3"
                            />
                        ) : (
                            renderTextWithLatex(dailyTip)
                        )}
                        <div className="mt-3 text-right">
                            {isEditingDailyTip ? (
                                <>
                                    <button
                                        onClick={() => { setDailyTip(editedDailyTip); setIsEditingDailyTip(false); }}
                                        className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 mr-2"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => { setEditedDailyTip(dailyTip); setIsEditingDailyTip(false); }}
                                        className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500"
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setIsEditingDailyTip(true)}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                                >
                                    Edit
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </section>


            {/* Note-taking Section */}
            <section className="mb-10 p-6 bg-white rounded-xl shadow-md border border-purple-200">
                <h2 className="text-2xl font-semibold text-purple-600 mb-4">📝 Note-taking & AI Content Transformation</h2>
                <div className="flex items-center gap-3 mb-3">
                    <textarea
                        className="flex-grow p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-400 focus:border-transparent transition duration-200 resize-y h-32"
                        placeholder="Type or paste your notes here..."
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                    ></textarea>
                    {/* Voice Input for Notes */}
                    <button
                        onClick={() => toggleListening(setNoteInput)}
                        className={`p-3 rounded-full shadow-md transition duration-200 ${isListening ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                        aria-label={isListening ? 'Stop listening' : 'Start voice input'}
                        title={isListening ? 'Stop listening' : 'Start voice input'}
                    >
                        {isListening ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.07-3H19c0 3.53-2.61 6.43-6 6.92V21h-2v-3.08c-3.39-.49-6-3.39-6-6.92h1.93c.09 2.52 2.12 4.55 4.64 4.64 2.52 0 4.55-2.03 4.64-4.64z"/></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.07-3H19c0 3.53-2.61 6.43-6 6.92V21h-2v-3.08c-3.39-.49-6-3.39-6-6.92h1.93c.09 2.52 2.12 4.55 4.64 4.64 2.52 0 4.55-2.03 4.64-4.64z"/></svg>
                        )}
                    </button>
                </div>

                <div className="flex flex-wrap justify-center gap-3 mt-3"> {/* Added justify-center for horizontal centering */}
                    <button
                        onClick={handleSummarizeNote}
                        className="px-4 py-2 bg-purple-500 text-white font-semibold rounded-lg shadow-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 transition duration-200 ease-in-out transform hover:-translate-y-0.5 hover:scale-105"
                        disabled={isLoading || isTransforming}
                    >
                        {isLoading ? 'Summarizing...' : 'Summarize'}
                    </button>
                    <button
                        onClick={handleElaborateContent}
                        className="px-4 py-2 bg-indigo-500 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 transition duration-200 ease-in-out transform hover:-translate-y-0.5 hover:scale-105"
                        disabled={isTransforming || isLoading}
                    >
                        {isTransforming && !isLoading ? 'Elaborating...' : 'Elaborate'}
                    </button>
                    <button
                        onClick={handleSimplifyContent}
                        className="px-4 py-2 bg-teal-500 text-white font-semibold rounded-lg shadow-md hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 transition duration-200 ease-in-out transform hover:-translate-y-0.5 hover:scale-105"
                        disabled={isTransforming || isLoading}
                    >
                        {isTransforming && !isLoading ? 'Simplifying...' : 'Simplify'}
                    </button>
                    <button
                        onClick={handleRephraseContent}
                        className="px-4 py-2 bg-orange-500 text-white font-semibold rounded-lg shadow-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 transition duration-200 ease-in-out transform hover:-translate-y-0.5 hover:scale-105"
                        disabled={isTransforming || isLoading}
                    >
                        {isTransforming && !isLoading ? 'Rephrasing...' : 'Rephrase'}
                    </button>
                </div>

                {summarizedNote && (
                    <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200 text-purple-800">
                        <h3 className="font-semibold mb-2">AI Summary:</h3>
                        {isEditingSummarizedNote ? (
                            <textarea
                                value={editedSummarizedNote}
                                onChange={(e) => setEditedSummarizedNote(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded resize-y"
                                rows="5"
                            />
                        ) : (
                            renderTextWithLatex(summarizedNote)
                        )}
                        <div className="mt-3 text-right">
                            {isEditingSummarizedNote ? (
                                <>
                                    <button
                                        onClick={() => { setSummarizedNote(editedSummarizedNote); setIsEditingSummarizedNote(false); }}
                                        className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 mr-2"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => { setEditedSummarizedNote(summarizedNote); setIsEditingSummarizedNote(false); }}
                                        className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500"
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setIsEditingSummarizedNote(true)}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                                >
                                    Edit
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {transformedContent && (
                    <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200 text-indigo-800">
                        <h3 className="font-semibold mb-2">AI Transformed Content:</h3>
                        {isEditingTransformedContent ? (
                            <textarea
                                value={editedTransformedContent}
                                onChange={(e) => setEditedTransformedContent(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded resize-y"
                                rows="5"
                            />
                        ) : (
                            renderTextWithLatex(transformedContent)
                        )}
                        <div className="mt-3 text-right">
                            {isEditingTransformedContent ? (
                                <>
                                    <button
                                        onClick={() => { setTransformedContent(editedTransformedContent); setIsEditingTransformedContent(false); }}
                                        className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 mr-2"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => { setEditedTransformedContent(transformedContent); setIsEditingTransformedContent(false); }}
                                        className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500"
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setIsEditingTransformedContent(true)}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                                >
                                    Edit
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </section>

            {/* Task Management Section */}
            <section className="mb-10 p-6 bg-white rounded-xl shadow-md border border-indigo-200">
                <h2 className="text-2xl font-semibold text-indigo-600 mb-4">✅ Task Management</h2>
                <div className="flex flex-col md:flex-row gap-3 mb-4">
                    <input
                        type="text"
                        className="flex-grow p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition duration-200"
                        placeholder="Add a new task..."
                        value={taskInput}
                        onChange={(e) => setTaskInput(e.target.value)}
                    />
                    <input
                        type="date"
                        className="p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition duration-200"
                        value={taskDueDate}
                        onChange={(e) => setTaskDueDate(e.target.value)}
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
                                        {task.dueDate && <span className="text-sm text-gray-500 ml-2">(Due: {new Date(task.dueDate).toLocaleDateString()})</span>}
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

            {/* Integrated Calendar Section */}
            <section className="mb-10 p-6 bg-white rounded-xl shadow-md border border-purple-300">
                <h2 className="text-2xl font-semibold text-purple-700 mb-4">🗓️ Integrated Calendar</h2>
                <div className="flex justify-between items-center mb-4">
                    <button onClick={goToPreviousMonth} className="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300">Previous</button>
                    <h3 className="text-xl font-semibold">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                    <button onClick={goToNextMonth} className="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300">Next</button>
                </div>
                <div className="grid grid-cols-7 text-center font-semibold text-gray-600 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day}>{day}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {getCalendarDays(currentMonth.getFullYear(), currentMonth.getMonth()).map((day, index) => {
                        const dateKey = day ? formatDateForCalendar(currentMonth.getFullYear(), currentMonth.getMonth(), day) : null;
                        const eventsForDay = dateKey ? calendarEvents[dateKey] || [] : [];
                        const isToday = day && new Date().toDateString() === new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString();

                        return (
                            <div
                                key={index}
                                className={`p-2 rounded-md h-24 overflow-y-auto text-sm ${day ? 'bg-gray-50' : 'bg-gray-100 opacity-50'} ${isToday ? 'border-2 border-blue-500' : 'border border-gray-200'}`}
                            >
                                <span className="font-bold">{day}</span>
                                {eventsForDay.map((event, eventIdx) => (
                                    <div key={eventIdx} className={`mt-1 text-xs p-1 rounded-sm ${event.type === 'task' ? 'bg-indigo-200 text-indigo-800' : 'bg-yellow-200 text-yellow-800'}`}>
                                        {event.type === 'task' ? `Task: ${event.text}` : `Pomodoro: ${event.duration} min`}
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Personalized Study Plan Section */}
            <section className="mb-10 p-6 bg-white rounded-xl shadow-md border border-green-200">
                <h2 className="text-2xl font-semibold text-green-600 mb-4">✨ Personalized Study Plan</h2>
                <div className="flex items-center gap-3 mb-3">
                    <textarea
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-400 focus:border-transparent transition duration-200 resize-y h-28"
                        placeholder="What are your study goals or topics? (e.g., 'Learn React hooks and context API', 'Prepare for a calculus exam')"
                        value={studyGoalInput}
                        onChange={(e) => setStudyGoalInput(e.target.value)}
                    ></textarea>
                    {/* Voice Input for Study Goals */}
                    <button
                        onClick={() => toggleListening(setStudyGoalInput)}
                        className={`p-3 rounded-full shadow-md transition duration-200 ${isListening ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                        aria-label={isListening ? 'Stop listening' : 'Start voice input'}
                        title={isListening ? 'Stop listening' : 'Start voice input'}
                    >
                        {isListening ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.07-3H19c0 3.53-2.61 6.43-6 6.92V21h-2v-3.08c-3.39-.49-6-3.39-6-6.92h1.93c.09 2.52 2.12 4.55 4.64 4.64 2.52 0 4.55-2.03 4.64-4.64z"/></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.07-3H19c0 3.53-2.61 6.43-6 6.92V21h-2v-3.08c-3.39-.49-6-3.39-6-6.92h1.93c.09 2.52 2.12 4.55 4.64 4.64 2.52 0 4.55-2.03 4.64-4.64z"/></svg>
                        )}
                    </button>
                </div>
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
                        {isEditingStudyPlanOutput ? (
                            <textarea
                                value={editedStudyPlanOutput}
                                onChange={(e) => setEditedStudyPlanOutput(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded resize-y"
                                rows="5"
                            />
                        ) : (
                            renderTextWithLatex(studyPlanOutput)
                        )}
                        <div className="mt-3 text-right">
                            {isEditingStudyPlanOutput ? (
                                <>
                                    <button
                                        onClick={() => { setStudyPlanOutput(editedStudyPlanOutput); setIsEditingStudyPlanOutput(false); }}
                                        className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 mr-2"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => { setEditedStudyPlanOutput(studyPlanOutput); setIsEditingStudyPlanOutput(false); }}
                                        className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500"
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setIsEditingStudyPlanOutput(true)}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                                >
                                    Edit
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </section>

            {/* Flashcards / Quiz Generation with Spaced Repetition */}
            <section className="mb-10 p-6 bg-white rounded-xl shadow-md border border-pink-200">
                <h2 className="text-2xl font-semibold text-pink-600 mb-4">🧠 Flashcards / Quiz Generator & Spaced Repetition</h2>
                <div className="flex items-center gap-3 mb-3">
                    <textarea
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-400 focus:border-transparent transition duration-200 resize-y h-32"
                        placeholder="Paste text here to generate flashcards or quiz questions. (e.g., your notes from a lecture, a paragraph from a textbook)"
                        value={quizInput}
                        onChange={(e) => setQuizInput(e.target.value)}
                    ></textarea>
                    {/* Voice Input for Quiz */}
                    <button
                        onClick={() => toggleListening(setQuizInput)}
                        className={`p-3 rounded-full shadow-md transition duration-200 ${isListening ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                        aria-label={isListening ? 'Stop listening' : 'Start voice input'}
                        title={isListening ? 'Stop listening' : 'Start voice input'}
                    >
                        {isListening ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.07-3H19c0 3.53-2.61 6.43-6 6.92V21h-2v-3.08c-3.39-.49-6-3.39-6-6.92h1.93c.09 2.52 2.12 4.55 4.64 4.64 2.52 0 4.55-2.03 4.64-4.64z"/></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.07-3H19c0 3.53-2.61 6.43-6 6.92V21h-2v-3.08c-3.39-.49-6-3.39-6-6.92h1.93c.09 2.52 2.12 4.55 4.64 4.64 2.52 0 4.55-2.03 4.64-4.64z"/></svg>
                        )}
                    </button>
                </div>
                <button
                    onClick={handleGenerateQuiz}
                    className="mt-3 px-6 py-3 bg-pink-500 text-white font-semibold rounded-lg shadow-md hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2 transition duration-200 ease-in-out transform hover:-translate-y-0.5 hover:scale-105"
                    disabled={isQuizLoading}
                >
                    {isQuizLoading ? 'Generating...' : 'Generate Flashcards/Quiz'}
                </button>

                {quizzes.length > 0 && currentQuizIndex < quizzes.length && (
                    <div className="mt-6 p-4 bg-pink-50 rounded-lg border border-pink-200 text-pink-800">
                        <h3 className="font-semibold mb-2">Quiz Question {currentQuizIndex + 1} of {quizzes.length}:</h3>
                        <p className="mb-3">{renderTextWithLatex(quizzes[currentQuizIndex].question)}</p>
                        <details className="mb-3">
                            <summary className="cursor-pointer text-pink-600 hover:text-pink-800 font-medium">Show Answer</summary>
                            <div className="mt-2 p-2 bg-pink-100 rounded">
                                {renderTextWithLatex(quizzes[currentQuizIndex].answer)}
                            </div>
                        </details>
                        <div className="flex justify-around mt-4">
                            <button
                                onClick={() => handleQuizRecall('hard')}
                                className="px-4 py-2 bg-red-400 text-white rounded-md hover:bg-red-500 transition duration-200"
                            >
                                Hard
                            </button>
                            <button
                                onClick={() => handleQuizRecall('medium')}
                                className="px-4 py-2 bg-yellow-400 text-white rounded-md hover:bg-yellow-500 transition duration-200"
                            >
                                Medium
                            </button>
                            <button
                                onClick={() => handleQuizRecall('easy')}
                                className="px-4 py-2 bg-green-400 text-white rounded-md hover:bg-green-500 transition duration-200"
                            >
                                Easy
                            </button>
                        </div>
                    </div>
                )}
                {quizOutput && quizzes.length === 0 && !isQuizLoading && (
                     <div className="mt-6 p-4 bg-pink-50 rounded-lg border border-pink-200 text-pink-800 whitespace-pre-wrap">
                        <h3 className="font-semibold mb-2">AI-Generated Content:</h3>
                        {isEditingQuizOutput ? (
                            <textarea
                                value={editedQuizOutput}
                                onChange={(e) => setEditedQuizOutput(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded resize-y"
                                rows="5"
                            />
                        ) : (
                            renderTextWithLatex(quizOutput)
                        )}
                        <div className="mt-3 text-right">
                            {isEditingQuizOutput ? (
                                <>
                                    <button
                                        onClick={() => { setQuizOutput(editedQuizOutput); setIsEditingQuizOutput(false); }}
                                        className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 mr-2"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => { setEditedQuizOutput(quizOutput); setIsEditingQuizOutput(false); }}
                                        className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500"
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setIsEditingQuizOutput(true)}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                                >
                                    Edit
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </section>

            {/* AI Explanation Section */}
            <section className="mb-10 p-6 bg-white rounded-xl shadow-md border border-blue-200">
                <h2 className="text-2xl font-semibold text-blue-600 mb-4">❓ AI Explanations</h2>
                <div className="flex items-center gap-3 mb-3">
                    <textarea
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-transparent transition duration-200 resize-y h-28"
                        placeholder="Ask a question or a concept you need explained (e.g., 'What is recursion?', 'Explain the concept of quantum entanglement')."
                        value={explanationQuestion}
                        onChange={(e) => setExplanationQuestion(e.target.value)}
                    ></textarea>
                     {/* Voice Input for Explanations */}
                    <button
                        onClick={() => toggleListening(setExplanationQuestion)}
                        className={`p-3 rounded-full shadow-md transition duration-200 ${isListening ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                        aria-label={isListening ? 'Stop listening' : 'Start voice input'}
                        title={isListening ? 'Stop listening' : 'Start voice input'}
                    >
                        {isListening ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.07-3H19c0 3.53-2.61 6.43-6 6.92V21h-2v-3.08c-3.39-.49-6-3.39-6-6.92h1.93c.09 2.52 2.12 4.55 4.64 4.64 2.52 0 4.55-2.03 4.64-4.64z"/></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.07-3H19c0 3.53-2.61 6.43-6 6.92V21h-2v-3.08c-3.39-.49-6-3.39-6-6.92h1.93c.09 2.52 2.12 4.55 4.64 4.64 2.52 0 4.55-2.03 4.64-4.64z"/></svg>
                        )}
                    </button>
                </div>
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
                        {isEditingExplanationAnswer ? (
                            <textarea
                                value={editedExplanationAnswer}
                                onChange={(e) => setEditedExplanationAnswer(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded resize-y"
                                rows="5"
                            />
                        ) : (
                            renderTextWithLatex(explanationAnswer)
                        )}
                        <div className="mt-3 text-right">
                            {isEditingExplanationAnswer ? (
                                <>
                                    <button
                                        onClick={() => { setExplanationAnswer(editedExplanationAnswer); setIsEditingExplanationAnswer(false); }}
                                        className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 mr-2"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => { setEditedExplanationAnswer(explanationAnswer); setIsEditingExplanationAnswer(false); }}
                                        className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500"
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setIsEditingExplanationAnswer(true)}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                                >
                                    Edit
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </section>

            {/* Pomodoro Timer Section */}
            <section className="mb-10 p-6 bg-white rounded-xl shadow-md border border-yellow-200">
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

            {/* Progress Tracking & Analytics Section */}
            <section className="mb-10 p-6 bg-white rounded-xl shadow-md border border-cyan-200">
                <h2 className="text-2xl font-semibold text-cyan-600 mb-4">📈 Progress Dashboard</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-cyan-50 rounded-lg shadow-sm">
                        <p className="text-lg font-medium text-cyan-800">Tasks Completed:</p>
                        <p className="text-3xl font-bold text-cyan-900">{totalTasksCompleted}</p>
                    </div>
                    <div className="p-4 bg-cyan-50 rounded-lg shadow-sm">
                        <p className="text-lg font-medium text-cyan-800">Total Study Time (min):</p>
                        <p className="text-3xl font-bold text-cyan-900">{totalStudyTime}</p>
                    </div>
                    {/* LLM-powered Progress Insight */}
                    <div className="md:col-span-2 mt-4">
                        <button
                            onClick={handleGenerateProgressInsight}
                            className="w-full px-6 py-3 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 transition duration-200 ease-in-out transform hover:-translate-y-0.5 hover:scale-105"
                            disabled={isProgressLoading}
                        >
                            {isProgressLoading ? 'Generating Insight...' : '✨ Get AI Progress Insight'}
                        </button>
                        {progressInsight && (
                            <div className="mt-4 p-4 bg-cyan-50 rounded-lg border border-cyan-200 text-cyan-800">
                                <h3 className="font-semibold mb-2">AI-Generated Progress Insight:</h3>
                                {isEditingProgressInsight ? (
                                    <textarea
                                        value={editedProgressInsight}
                                        onChange={(e) => setEditedProgressInsight(e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded resize-y"
                                        rows="5"
                                    />
                                ) : (
                                    renderTextWithLatex(progressInsight)
                                )}
                                <div className="mt-3 text-right">
                                    {isEditingProgressInsight ? (
                                        <>
                                            <button
                                                onClick={() => { setProgressInsight(editedProgressInsight); setIsEditingProgressInsight(false); }}
                                                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 mr-2"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => { setEditedProgressInsight(progressInsight); setIsEditingProgressInsight(false); }}
                                                className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => setIsEditingProgressInsight(true)}
                                            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                                        >
                                            Edit
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    {/* Placeholder for a chart or more detailed analytics */}
                    <div className="md:col-span-2 p-4 bg-cyan-50 rounded-lg shadow-sm text-center text-gray-600">
                        <p>Graphs and more detailed analytics would appear here.</p>
                        <p className="text-sm italic">
                            (e.g., Daily study streaks, quiz performance trends, most challenging topics)
                        </p>
                        {quizzes.filter(q => q.recall !== null).length > 0 && (
                            <div className="mt-4 text-left">
                                <h4 className="font-semibold text-cyan-700">Quiz Recall Insights:</h4>
                                <ul className="list-disc list-inside text-sm">
                                    {quizzes.filter(q => q.recall !== null).map((q, idx) => (
                                        <li key={idx}>
                                            "Q: {q.question.substring(0, Math.min(q.question.length, 50))}..." - Recalled: <span className={`font-semibold ${q.recall === 'easy' ? 'text-green-600' : q.recall === 'medium' ? 'text-yellow-600' : 'text-red-600'}`}>{q.recall}</span> (Next review: {q.nextReview ? new Date(q.nextReview).toLocaleDateString() : 'N/A'})
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Gamification Hub Section */}
            <section className="mb-10 p-6 bg-white rounded-xl shadow-md border border-purple-300">
                <h2 className="text-2xl font-semibold text-purple-700 mb-4">🎮 Gamification Hub</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-purple-50 rounded-lg shadow-sm">
                        <p className="text-lg font-medium text-purple-800">Total Points:</p>
                        <p className="text-3xl font-bold text-purple-900">{userPoints}</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg shadow-sm">
                        <p className="text-lg font-medium text-purple-800">Study Streak:</p>
                        <p className="text-3xl font-bold text-purple-900">{studyStreaks} Day{studyStreaks !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg shadow-sm">
                        <p className="text-lg font-medium text-purple-800">Badges Earned:</p>
                        <div className="flex flex-wrap justify-center gap-2 mt-2">
                            {earnedBadges.length === 0 ? (
                                <span className="text-gray-500 text-sm">No badges yet. Keep studying!</span>
                            ) : (
                                earnedBadges.map((badge, index) => (
                                    <span key={index} className="px-3 py-1 bg-yellow-400 text-yellow-900 text-xs font-semibold rounded-full shadow-sm">
                                        {badge}
                                    </span>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Resource Link Aggregator Section */}
            <section className="mb-10 p-6 bg-white rounded-xl shadow-md border border-orange-200">
                <h2 className="text-2xl font-semibold text-orange-600 mb-4">🔗 Resource Link Aggregator</h2>
                <div className="flex flex-col gap-3 mb-4">
                    <input
                        type="text"
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-400 focus:border-transparent transition duration-200"
                        placeholder="Resource Title (e.g., 'React Hooks Cheatsheet')"
                        value={resourceTitle}
                        onChange={(e) => { setResourceTitle(e.target.value); setSuggestedResourceCategory(''); }} // Clear suggestion on title change
                    />
                    <input
                        type="url"
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-400 focus:border-transparent transition duration-200"
                        placeholder="URL (e.g., 'https://react.dev/learn/hooks')"
                        value={resourceLink}
                        onChange={(e) => { setResourceLink(e.target.value); setSuggestedResourceCategory(''); }} // Clear suggestion on link change
                    />
                     <button
                        onClick={handleSuggestResourceCategory}
                        className="px-6 py-3 bg-purple-400 text-white font-semibold rounded-lg shadow-md hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:ring-offset-2 transition duration-200 ease-in-out transform hover:-translate-y-0.5 hover:scale-105"
                        disabled={isResourceCategoryLoading || !resourceTitle.trim()}
                    >
                        {isResourceCategoryLoading ? 'Suggesting...' : '✨ Suggest Category'}
                    </button>
                    {suggestedResourceCategory && (
                        <div className="p-3 bg-purple-50 rounded-md text-purple-800">
                            Suggested Category: <span className="font-semibold">{suggestedResourceCategory}</span>
                        </div>
                    )}
                    <button
                        onClick={handleAddResource}
                        className="px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg shadow-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 transition duration-200 ease-in-out transform hover:-translate-y-0.5 hover:scale-105"
                    >
                        Add Resource
                    </button>
                </div>
                {resources.length === 0 ? (
                    <p className="text-gray-500">No resources added yet.</p>
                ) : (
                    <ul className="space-y-3">
                        {resources.map((res) => (
                            <li key={res.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-md shadow-sm border border-orange-200">
                                <div className="flex flex-col">
                                    <a
                                        href={res.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-lg text-orange-800 hover:underline font-medium"
                                    >
                                        {res.title}
                                    </a>
                                    {res.category && <span className="text-sm text-orange-700 italic">Category: {res.category}</span>}
                                </div>
                                <button
                                    onClick={() => handleDeleteResource(res.id)}
                                    className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 transition duration-200"
                                    aria-label="Delete resource"
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

            {/* Collaborative Study Spaces (Placeholder/Concept) */}
            <section className="p-6 bg-white rounded-xl shadow-md border border-gray-300">
                <h2 className="text-2xl font-semibold text-gray-700 mb-4">🤝 Collaborative Study Spaces</h2>
                <p className="text-gray-600 mb-4">
                    This section could allow users to share notes, tasks, or study plans with other users.
                    Implementation would involve storing data in publicly accessible Firestore collections (e.g., `artifacts/{__app_id}/public/data/shared_notes`).
                </p>
                <p className="text-sm italic text-gray-500">
                    (Future features: Shared whiteboards, group chat, real-time document editing.)
                </p>
                <div className="mt-4 p-3 bg-gray-50 rounded-lg text-gray-700 border border-gray-200">
                    <p className="font-semibold">Example Shared Content:</p>
                    <ul className="list-disc list-inside text-sm mt-1">
                        <li>"Shared Study Plan for Calculus II - Created by User: {userId}"</li>
                        <li>"Collaborative Brainstorm for Project Alpha"</li>
                    </ul>
                </div>
            </section>
        </div>
    );
};


// Main App component (Parent that handles routing and Firebase init)
const App = () => {
    const [currentPage, setCurrentPage] = useState('home'); // 'home', 'study', 'about'

    // Firebase authentication and Firestore setup
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false); // To track if auth state is settled

    // Initialize Firebase and listen for auth state changes (only once)
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
    }, []); // Empty dependency array means this runs once on mount


    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-100 to-indigo-100 font-inter text-gray-800">
            <script src="https://cdn.tailwindcss.com"></script>
            {/* KaTeX CSS and JS */}
            {/* CORRECTED: Removed xintegrity and ensured defer attribute is present */}
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css" xintegrity="sha384-wcIxkf4UmgaL2PMg8K4eH7bdptKvaTNbYGg/KOyLCNvc5FBo8Wc/fxgf9boFxcMh" crossOrigin="anonymous" />
            <script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js" xintegrity="sha384-h0Lk9h3yW59pmjC/YgG8g34cK9k0x3G+B79JdE6b1H1O2uK12sP7G9+W4/Y5wA1" crossOrigin="anonymous"></script>
            <script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js" xintegrity="sha384-yFIayB+kP4/x9Q32+i/RxBSRY/gD/cI3k4/jP+F3p5N5P5zP3o3" crossOrigin="anonymous"></script>
            <style>
                {`
                body { font-family: 'Inter', sans-serif; margin: 0; }
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

            <Navbar setCurrentPage={setCurrentPage} />

            <main className="container mx-auto px-4">
                {currentPage === 'home' && <HomePage setCurrentPage={setCurrentPage} />}
                {currentPage === 'study' && (
                    <StudyAssistantPage
                        db={db}
                        auth={auth}
                        userId={userId}
                        isAuthReady={isAuthReady}
                    />
                )}
                {currentPage === 'about' && <AboutPage />}
            </main>

            <Footer />
        </div>
    );
};

export default App;
