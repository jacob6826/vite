import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    sendPasswordResetEmail
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    doc, 
    deleteDoc, 
    updateDoc, 
    setDoc,
    getDoc,
    query,
    where,
    getDocs,
    setLogLevel 
} from 'firebase/firestore';
import { Clock, Flag, Plus, Trash2, Edit, Save, X, Target, Info, Calendar, Link as LinkIcon, User, LogOut, Award, Download, CheckSquare, Share2, ClipboardCopy, Moon, Sun } from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
    ? JSON.parse(__firebase_config) 
    : {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_AUTH_DOMAIN",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_STORAGE_BUCKET",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    };

// --- App ID ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'benedict-runs-default';

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setLogLevel('debug');

// --- Helper Function to convert time string to seconds ---
const timeToSeconds = (time) => {
    if (!time || typeof time !== 'string') return Infinity;
    const parts = time.split(':').map(Number);
    let seconds = 0;
    if (parts.length === 3) { // HH:MM:SS
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) { // MM:SS
        seconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 1) { // SS
        seconds = parts[0];
    }
    return isNaN(seconds) ? Infinity : seconds;
};

const STANDARD_DISTANCES = ["5k", "10k", "1/2 Marathon", "Marathon"];

// --- Shareable Card Components ---
const CompletedRaceShareableCard = ({ race, isPR }) => (
    <div id={`shareable-completed-card-${race.id}`} className="bg-slate-50 border border-slate-200 p-8 rounded-lg w-[450px]">
        <div className="flex items-start gap-3">
             {isPR && <Award className="text-amber-500 flex-shrink-0 mt-1" size={24} />}
             <p className="font-bold text-2xl text-slate-800">{race.name}</p>
        </div>
        <div className="flex flex-col gap-4 mt-6 text-lg">
            <p className="text-slate-600 flex items-start"><Flag size={24} className="mr-4 text-indigo-500 flex-shrink-0 mt-0.5"/><span><strong>Distance:</strong><span className="ml-2 font-normal">{race.distance || 'N/A'}</span></span></p>
            <p className="text-indigo-600 font-semibold flex items-start"><Clock size={24} className="mr-4 flex-shrink-0 mt-0.5"/><span><strong>Time:</strong><span className="ml-2 font-normal">{race.time}</span></span></p>
            <p className="text-slate-600 flex items-start"><Calendar size={24} className="mr-4 text-indigo-500 flex-shrink-0 mt-0.5"/><span><strong>Date:</strong><span className="ml-2 font-normal">{race.date ? new Date(race.date + 'T00:00:00').toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' }) : 'No Date'}</span></span></p>
        </div>
        {race.notes && (
            <div className="mt-6 pt-6 border-t border-slate-200">
                 <p className="text-base text-slate-500">{race.notes}</p>
            </div>
        )}
    </div>
);

const UpcomingRaceShareableCard = ({ race }) => (
    <div id={`shareable-upcoming-card-${race.id}`} className="bg-slate-50 border border-slate-200 p-8 rounded-lg w-[450px]">
        <p className="font-bold text-2xl text-slate-800">{race.name}</p>
        <p className="text-lg text-slate-500 mt-2 flex items-center"><Calendar size={20} className="inline mr-3 text-indigo-500 flex-shrink-0"/><span>{race.date ? new Date(race.date + 'T00:00:00').toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' }) : 'Date TBD'}</span></p>
        <div className="mt-6 pt-6 border-t border-slate-200 flex flex-col gap-4 text-lg">
            <p className="flex items-start"><Flag size={24} className="mr-4 text-indigo-500 flex-shrink-0 mt-0.5"/><span><strong>Distance:</strong><span className="ml-2 font-normal">{race.distance || 'N/A'}</span></span></p>
            <p className="flex items-start"><Target size={24} className="mr-4 text-indigo-500 flex-shrink-0 mt-0.5"/><span><strong>Goal:</strong><span className="ml-2 font-normal">{race.goalTime || 'N/A'}</span></span></p>
            {race.info && <p className="flex items-start"><Info size={24} className="mr-4 text-indigo-500 flex-shrink-0 mt-0.5"/><span><strong>Info:</strong><span className="ml-2 font-normal">{race.info}</span></span></p>}
        </div>
    </div>
);


// --- Main App Component ---
export default function App() {
    // --- State Management ---
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    // Modal States
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showSignUpModal, setShowSignUpModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareImageData, setShareImageData] = useState('');
    const [shareImageName, setShareImageName] = useState('');
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [showPRModal, setShowPRModal] = useState(false);
    const [newPRData, setNewPRData] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const settingsRef = useRef(null);
    const [showUpdateInfoModal, setShowUpdateInfoModal] = useState(false);

    // Theme state
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') !== 'light';
        }
        return true;
    });

    // Notification State
    const [notificationMessage, setNotificationMessage] = useState('');
    const [showNotification, setShowNotification] = useState(false);
    
    // Share State
    const [raceToShare, setRaceToShare] = useState(null);
    
    // Complete Race State
    const [raceToComplete, setRaceToComplete] = useState(null);
    const [completionTime, setCompletionTime] = useState('');
    const [completionNotes, setCompletionNotes] = useState('');

    // Completed Races State
    const [completedRaces, setCompletedRaces] = useState([]);
    const [personalRecords, setPersonalRecords] = useState({});
    const [newRaceName, setNewRaceName] = useState('');
    const [newRaceTime, setNewRaceTime] = useState('');
    const [newRaceDate, setNewRaceDate] = useState('');
    const [newRaceLink, setNewRaceLink] = useState('');
    const [newRaceNotes, setNewRaceNotes] = useState('');
    const [newRaceDistance, setNewRaceDistance] = useState('5k');
    const [showCustomHistoryDistance, setShowCustomHistoryDistance] = useState(false);
    
    // Upcoming Races State
    const [upcomingRaces, setUpcomingRaces] = useState([]);
    const [newUpcomingRace, setNewUpcomingRace] = useState({ name: '', date: '', distance: '5k', goalTime: '', link: '', info: '' });
    const [showCustomUpcomingDistance, setShowCustomUpcomingDistance] = useState(false);
    
    const [editingUpcomingRaceId, setEditingUpcomingRaceId] = useState(null);
    const [editingUpcomingRaceData, setEditingUpcomingRaceData] = useState({ name: '', date: '', distance: '', goalTime: '', link: '', info: '' });
    const [showCustomEditDistance, setShowCustomEditDistance] = useState(false);
    
    // --- Effect to load external scripts ---
    useEffect(() => {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.async = true;
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    // --- Authentication Effect ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile`, "data");
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    setUserProfile(userDocSnap.data());
                } else {
                     setUserProfile({ name: 'Runner', username: 'Runner' });
                }
            } else {
                setCurrentUser(null);
                setUserProfile(null);
                setCompletedRaces([]);
                setUpcomingRaces([]);
            }
            setIsAuthReady(true);
        });
        return () => unsubscribe();
    }, []);
    
    // --- Dark Mode Effect ---
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    // --- Click outside settings menu handler ---
    useEffect(() => {
        function handleClickOutside(event) {
            if (settingsRef.current && !settingsRef.current.contains(event.target)) {
                setShowSettings(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [settingsRef]);
    
    // --- Personal Records Calculation Effect ---
    useEffect(() => {
        const calculatePRs = () => {
            const records = {};
            STANDARD_DISTANCES.forEach(distance => {
                const relevantRaces = completedRaces.filter(race => 
                    race.distance && race.distance.toLowerCase().trim() === distance.toLowerCase().trim()
                );

                if (relevantRaces.length > 0) {
                    const bestRace = relevantRaces.reduce((best, current) => {
                        return timeToSeconds(current.time) < timeToSeconds(best.time) ? current : best;
                    });
                    records[distance] = bestRace;
                }
            });
            setPersonalRecords(records);
        };
        
        if (completedRaces.length > 0) {
            calculatePRs();
        }
    }, [completedRaces]);

    // --- Image Generation Effect ---
    useEffect(() => {
        if (raceToShare) {
            setTimeout(() => {
                const cardId = `shareable-${raceToShare.type}-card-${raceToShare.data.id}`;
                const cardElement = document.getElementById(cardId);

                if (cardElement && typeof window.html2canvas === 'function') {
                    showAndHideNotification('Generating image preview...', 5000);
                    window.html2canvas(cardElement, { scale: 2 }).then(canvas => {
                        setShareImageData(canvas.toDataURL('image/png'));
                        setShareImageName(`${raceToShare.data.name.replace(/ /g, '_')}.png`);
                        setShowShareModal(true);
                        showAndHideNotification('Preview ready!');
                    }).catch(err => {
                        console.error("html2canvas error:", err);
                        showAndHideNotification('Could not generate image.');
                    });
                } else {
                    showAndHideNotification('Error creating image.');
                }
                setRaceToShare(null); // Reset after attempting to render
            }, 100);
        }
    }, [raceToShare]);


    // --- General Handlers ---
    const showAndHideNotification = (message, duration = 3000) => {
        setNotificationMessage(message);
        setShowNotification(true);
        setTimeout(() => {
            setShowNotification(false);
        }, duration);
    };

    const handleInitiateShare = (race, type) => {
        const isPR = type === 'completed' && personalRecords[race.distance]?.id === race.id;
        setRaceToShare({ data: race, type, isPR });
    };

    const handleOpenCompleteModal = (race) => {
        setRaceToComplete(race);
        setShowCompleteModal(true);
    };

    const handleCompleteRace = async (e) => {
        e.preventDefault();
        if (!raceToComplete || !completionTime) {
            showAndHideNotification("Please enter a completion time.");
            return;
        }

        const currentPR = personalRecords[raceToComplete.distance];
        const newTimeInSeconds = timeToSeconds(completionTime);
        let isNewPR = false;
        if (STANDARD_DISTANCES.includes(raceToComplete.distance)) {
            if (!currentPR || newTimeInSeconds < timeToSeconds(currentPR?.time)) {
                isNewPR = true;
            }
        }

        const newCompletedRace = {
            name: raceToComplete.name,
            distance: raceToComplete.distance,
            time: completionTime,
            date: raceToComplete.date,
            link: raceToComplete.link || '',
            notes: completionNotes
        };

        try {
            await addDoc(collection(db, `artifacts/${appId}/users/${currentUser.uid}/completedRaces`), newCompletedRace);
            await deleteDoc(doc(db, `artifacts/${appId}/users/${currentUser.uid}/upcomingRaces`, raceToComplete.id));

            setRaceToComplete(null);
            setCompletionTime('');
            setCompletionNotes('');
            setShowCompleteModal(false);

            if (isNewPR) {
                setNewPRData(newCompletedRace);
                setShowPRModal(true);
            } else {
                showAndHideNotification("Race moved to history!");
            }
        } catch (error) {
            console.error("Error completing race:", error);
            showAndHideNotification("Error moving race to history.");
        }
    };

    const handleAddCompletedRace = async (e) => {
        e.preventDefault();
        if (!newRaceName.trim() || !newRaceTime.trim() || !newRaceDate.trim() || !newRaceDistance.trim()) return;
        
        const currentPR = personalRecords[newRaceDistance];
        const newTimeInSeconds = timeToSeconds(newRaceTime);
        let isNewPR = false;
        if (STANDARD_DISTANCES.includes(newRaceDistance)) {
            if (!currentPR || newTimeInSeconds < timeToSeconds(currentPR?.time)) {
                isNewPR = true;
            }
        }

        const newRace = {
            name: newRaceName,
            time: newRaceTime,
            date: newRaceDate,
            link: newRaceLink,
            distance: newRaceDistance,
            notes: newRaceNotes
        };
        
        try {
            await addDoc(collection(db, `artifacts/${appId}/users/${currentUser.uid}/completedRaces`), newRace);
            if (isNewPR) {
                setNewPRData(newRace);
                setShowPRModal(true);
            }
            setNewRaceName(''); setNewRaceTime(''); setNewRaceDate(''); setNewRaceLink(''); setNewRaceNotes(''); setNewRaceDistance('5k'); setShowCustomHistoryDistance(false);
        } catch (error) {
            console.error("Error adding completed race:", error);
            showAndHideNotification("Error adding race to history.");
        }
    };
    
    const handleDeleteRace = async (id, collectionName) => {
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${currentUser.uid}/${collectionName}`, id));
        } catch (error) {
            console.error("Error deleting race:", error);
            showAndHideNotification("Error deleting race.");
        }
    };
    
    const handleAddUpcomingRace = async (e) => {
        e.preventDefault();
        if (!newUpcomingRace.name.trim() || !newUpcomingRace.date.trim()) return;
        
        try {
            await addDoc(collection(db, `artifacts/${appId}/users/${currentUser.uid}/upcomingRaces`), newUpcomingRace);
            setNewUpcomingRace({ name: '', date: '', distance: '5k', goalTime: '', link: '', info: '' });
            setShowCustomUpcomingDistance(false);
        } catch (error) {
             console.error("Error adding upcoming race:", error);
            showAndHideNotification("Error adding upcoming race.");
        }
    };
    
    const handleStartEditUpcomingRace = (race) => {
        setEditingUpcomingRaceId(race.id);
        setEditingUpcomingRaceData(race);
        setShowCustomEditDistance(!STANDARD_DISTANCES.includes(race.distance));
    };
    
    const handleSaveUpcomingRace = async (id) => {
        try {
            await updateDoc(doc(db, `artifacts/${appId}/users/${currentUser.uid}/upcomingRaces`, id), editingUpcomingRaceData);
            setEditingUpcomingRaceId(null);
        } catch(error){
            console.error("Error updating upcoming race:", error);
            showAndHideNotification("Error updating race.");
        }
    };
    
    const handleUpdateUserInfo = async (newName, newEmail) => {
        if (!currentUser) return;
        const profileRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/profile`, "data");
        try {
            await updateDoc(profileRef, { name: newName, email: newEmail });
            setUserProfile(prev => ({ ...prev, name: newName, email: newEmail }));
            setShowUpdateInfoModal(false);
            showAndHideNotification("Profile updated successfully!");
        } catch (error) {
            console.error("Error updating profile:", error);
            showAndHideNotification("Could not update profile.");
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
    };

    const handleResetPassword = () => {
        setShowSettings(false);
        if (!userProfile?.email) {
            showAndHideNotification("No email on file to send reset link.", 4000);
            return;
        }
        sendPasswordResetEmail(auth, userProfile.email)
            .then(() => {
                showAndHideNotification(`Password reset link sent to ${userProfile.email}`);
            })
            .catch((error) => {
                console.error("Password reset error:", error);
                showAndHideNotification("Could not send password reset link.");
            });
    };
    
    // --- Render ---
    return (
        <div className={`bg-slate-50 dark:bg-gray-900 text-slate-800 dark:text-slate-200 min-h-screen font-sans antialiased`}>
            {showNotification && (
                <div className="fixed top-5 right-5 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg z-50">
                    {notificationMessage}
                </div>
            )}
            {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} onSwitch={() => { setShowLoginModal(false); setShowSignUpModal(true); }} />}
            {showSignUpModal && <SignUpModal onClose={() => setShowSignUpModal(false)} onSwitch={() => { setShowSignUpModal(false); setShowLoginModal(true); }} />}
            {showShareModal && (
                <ShareModal 
                    race={raceToShare?.data}
                    type={raceToShare?.type}
                    imageData={shareImageData} 
                    imageName={shareImageName}
                    onClose={() => { setShowShareModal(false); setRaceToShare(null); }} 
                    onShareAsText={() => showAndHideNotification('Race details copied!')}
                />
            )}
            {showCompleteModal && (
                <CompleteRaceModal
                    race={raceToComplete}
                    time={completionTime}
                    setTime={setCompletionTime}
                    notes={completionNotes}
                    setNotes={setCompletionNotes}
                    onClose={() => setShowCompleteModal(false)}
                    onComplete={handleCompleteRace}
                />
            )}
            {showPRModal && <NewPRModal race={newPRData} onClose={() => { setShowPRModal(false); setNewPRData(null); }} />}
            {showUpdateInfoModal && (
                <UpdateInfoModal 
                    userProfile={userProfile}
                    onClose={() => setShowUpdateInfoModal(false)}
                    onUpdate={handleUpdateUserInfo}
                />
            )}


            {/* Hidden container for generating shareable images */}
            <div className="absolute -left-full top-0">
                {raceToShare && raceToShare.type === 'completed' && <CompletedRaceShareableCard race={raceToShare.data} isPR={raceToShare.isPR} />}
                {raceToShare && raceToShare.type === 'upcoming' && <UpcomingRaceShareableCard race={raceToShare.data} />}
            </div>

            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <header className="flex justify-between items-center mb-12">
                    <div className="flex items-center">
                        <img src="https://storage.googleapis.com/gemini-prod-us-west1-assets/image_f2dd41.jpg" alt="Benedict Runs Logo" className="w-16 h-16 mr-4 rounded-lg" />
                        <div className="text-left">
                            <h1 className="text-4xl sm:text-5xl font-bold text-indigo-600 dark:text-indigo-400 tracking-tight">{userProfile?.name ? `${userProfile.name}'s` : "My"} Runs</h1>
                            <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">Your personal race tracking dashboard</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isAuthReady && (
                            currentUser ? (
                                <div className="relative" ref={settingsRef}>
                                    <button onClick={() => setShowSettings(s => !s)} className="flex items-center gap-2 text-slate-600 dark:text-slate-300 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800">
                                        <User size={18}/>
                                        <span className="font-semibold hidden sm:inline">{userProfile?.name}</span>
                                    </button>
                                    {showSettings && (
                                        <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl z-10 border border-slate-200 dark:border-gray-700">
                                            <div className="p-2">
                                                <button onClick={() => { setShowUpdateInfoModal(true); setShowSettings(false); }} className="w-full text-left px-3 py-2 text-sm rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-700">Update Info</button>
                                                <button onClick={handleResetPassword} className="w-full text-left px-3 py-2 text-sm rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-700">Reset Password</button>
                                                <div className="flex justify-between items-center px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                                                    <span>Dark Mode</span>
                                                    <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-10 h-5 rounded-full flex items-center p-0.5 transition-colors ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                                        <span className={`w-4 h-4 rounded-full bg-white transform transition-transform ${isDarkMode ? 'translate-x-5' : 'translate-x-0'}`}></span>
                                                    </button>
                                                </div>
                                                <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10">Log Out</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <button onClick={() => setShowLoginModal(true)} className="font-semibold text-indigo-600 hover:text-indigo-800 py-2 px-4 rounded-lg">Log In</button>
                                    <button onClick={() => setShowSignUpModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-all duration-300 shadow-sm hover:shadow-md">Sign Up</button>
                                </>
                            )
                        )}
                    </div>
                </header>

                {currentUser ? (
                    <>
                        <PersonalRecords records={personalRecords} />
                        <main className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-10">
                            {/* Race History Section */}
                            <section className="bg-white dark:bg-gray-800/50 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700">
                                <h2 className="text-2xl font-bold mb-5 flex items-center"><Flag className="mr-3 text-indigo-500 dark:text-indigo-400" />Race History</h2>
                                <form onSubmit={handleAddCompletedRace} className="mb-6 grid grid-cols-1 md:grid-cols-6 gap-4">
                                   <input type="text" value={newRaceName} onChange={(e) => setNewRaceName(e.target.value)} placeholder="Race Name" className="md:col-span-6 bg-slate-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-slate-400 rounded-lg px-4 py-2.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                                   
                                   <div className={`grid gap-2 md:col-span-2 ${showCustomHistoryDistance ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                        <select value={showCustomHistoryDistance ? 'Custom' : newRaceDistance} 
                                            onChange={e => {
                                                if (e.target.value === 'Custom') {
                                                    setShowCustomHistoryDistance(true);
                                                    setNewRaceDistance('');
                                                } else {
                                                    setShowCustomHistoryDistance(false);
                                                    setNewRaceDistance(e.target.value);
                                                }
                                            }}
                                            className="bg-slate-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-slate-400 rounded-lg px-4 py-2.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                            {STANDARD_DISTANCES.map(d => <option key={d} value={d}>{d}</option>)}
                                            <option value="Custom">Custom</option>
                                        </select>
                                        {showCustomHistoryDistance && <input type="text" value={newRaceDistance} onChange={e => setNewRaceDistance(e.target.value)} placeholder="Custom" className="bg-slate-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-slate-400 rounded-lg px-4 py-2.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>}
                                   </div>

                                   <input type="text" value={newRaceTime} onChange={(e) => setNewRaceTime(e.target.value)} placeholder="Time ( 4:25:30)" className="md:col-span-2 bg-slate-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-slate-400 rounded-lg px-4 py-2.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                                   
                                   <input type="date" value={newRaceDate} onChange={(e) => setNewRaceDate(e.target.value)} className={`md:col-span-2 w-full bg-slate-100 dark:bg-gray-700 dark:border-gray-600 rounded-lg px-4 py-2.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${!newRaceDate ? 'text-slate-400 dark:text-slate-500' : 'dark:text-white'}`}/>

                                   <div className="relative md:col-span-6">
                                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18}/>
                                        <input type="url" value={newRaceLink} onChange={(e) => setNewRaceLink(e.target.value)} placeholder="Race Website Link (Optional)" className="w-full bg-slate-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-slate-400 rounded-lg px-4 py-2.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 pl-10"/>
                                   </div>
                                   
                                   <textarea value={newRaceNotes} onChange={(e) => setNewRaceNotes(e.target.value)} placeholder="Notes (e.g., weather, how you felt)" className="md:col-span-6 bg-slate-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-slate-400 rounded-lg px-4 py-2.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-20"/>

                                   <button type="submit" className="md:col-span-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center transition-all duration-300 shadow-sm hover:shadow-md"><Plus size={20} className="mr-2"/> Add To History</button>
                                </form>
                                <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-2">
                                   {completedRaces.length > 0 ? completedRaces.map(race => {
                                       const isPR = personalRecords[race.distance]?.id === race.id;
                                       return (
                                        <div id={`completed-card-${race.id}`} key={race.id} className="bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 p-4 rounded-lg flex justify-between items-center transition-all hover:shadow-md dark:hover:border-gray-600">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    {isPR && <Award className="text-amber-500 flex-shrink-0" size={18} />}
                                                    <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">{race.name}</p>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm">
                                                    <p className="text-slate-500 dark:text-slate-400 flex items-center"><Flag size={14} className="mr-1.5"/>{race.distance || 'N/A'}</p>
                                                    <p className="text-indigo-600 dark:text-indigo-400 font-medium flex items-center"><Clock size={14} className="mr-1.5" />{race.time}</p>
                                                    <p className="text-slate-500 dark:text-slate-400 flex items-center"><Calendar size={14} className="mr-1.5"/>{race.date ? new Date(race.date + 'T00:00:00').toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' }) : 'No Date'}</p>
                                                </div>
                                                {race.notes && (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-200 dark:border-gray-600">
                                                        {race.notes}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                                <button onClick={() => handleInitiateShare(race, 'completed')} className="text-slate-400 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors p-2 rounded-full hover:bg-indigo-50 dark:hover:bg-gray-600"><Share2 size={18}/></button>
                                                {race.link && <a href={race.link} target="_blank" rel="noopener noreferrer" className="text-slate-400 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors p-2 rounded-full hover:bg-indigo-50 dark:hover:bg-gray-600" aria-label="Race Website"><LinkIcon size={18}/></a>}
                                                <button onClick={() => handleDeleteCompletedRace(race.id)} className="text-slate-400 dark:text-slate-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-500/20" aria-label="Delete race"><Trash2 size={18}/></button>
                                            </div>
                                        </div>
                                    )}) : <p className="text-slate-400 dark:text-slate-500 text-center py-8">No completed races yet.</p>}
                                </div>
                            </section>

                            {/* Upcoming Races Section */}
                            <section className="bg-white dark:bg-gray-800/50 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700">
                                 <h2 className="text-2xl font-bold mb-5 flex items-center"><Calendar className="mr-3 text-indigo-500 dark:text-indigo-400" />Upcoming Races</h2>
                                 <form onSubmit={handleAddUpcomingRace} className="mb-6 grid grid-cols-1 md:grid-cols-6 gap-4">
                                    <input type="text" placeholder="Race Name" value={newUpcomingRace.name} onChange={(e) => setNewUpcomingRace({...newUpcomingRace, name: e.target.value})} className="md:col-span-6 bg-slate-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-slate-400 rounded-lg px-4 py-2.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                                    
                                    <div className={`md:col-span-2 grid gap-2 ${showCustomUpcomingDistance ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                        <select value={showCustomUpcomingDistance ? 'Custom' : newUpcomingRace.distance} 
                                            onChange={e => {
                                                const val = e.target.value;
                                                setShowCustomUpcomingDistance(val === 'Custom');
                                                setNewUpcomingRace({...newUpcomingRace, distance: val === 'Custom' ? '' : val});
                                            }}
                                            className="bg-slate-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-slate-400 rounded-lg px-4 py-2.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                            {STANDARD_DISTANCES.map(d => <option key={d} value={d}>{d}</option>)}
                                            <option value="Custom">Custom</option>
                                        </select>
                                        {showCustomUpcomingDistance && <input type="text" value={newUpcomingRace.distance} onChange={e => setNewUpcomingRace({...newUpcomingRace, distance: e.target.value})} placeholder="Custom" className="bg-slate-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-slate-400 rounded-lg px-4 py-2.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>}
                                   </div>
                                    <input type="text" placeholder="Goal Time" value={newUpcomingRace.goalTime} onChange={(e) => setNewUpcomingRace({...newUpcomingRace, goalTime: e.target.value})} className="md:col-span-2 bg-slate-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-slate-400 rounded-lg px-4 py-2.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                                    
                                    <input type="date" value={newUpcomingRace.date} onChange={(e) => setNewUpcomingRace({...newUpcomingRace, date: e.target.value})} className={`md:col-span-2 w-full bg-slate-100 dark:bg-gray-700 dark:border-gray-600 rounded-lg px-4 py-2.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${!newUpcomingRace.date ? 'text-slate-400 dark:text-slate-500' : 'dark:text-white'}`}/>
                                    
                                    <div className="relative md:col-span-6">
                                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18}/>
                                        <input type="url" placeholder="Race Website Link (Optional)" value={newUpcomingRace.link} onChange={(e) => setNewUpcomingRace({...newUpcomingRace, link: e.target.value})} className="w-full bg-slate-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-slate-400 rounded-lg px-4 py-2.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 pl-10"/>
                                    </div>

                                    <textarea placeholder="Related Info (e.g., location, registration link)" value={newUpcomingRace.info} onChange={(e) => setNewUpcomingRace({...newUpcomingRace, info: e.target.value})} className="md:col-span-6 bg-slate-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-slate-400 rounded-lg px-4 py-2.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-20 resize-none"/>
                                    <button type="submit" className="md:col-span-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center transition-all duration-300 shadow-sm hover:shadow-md"><Plus size={20} className="mr-2"/> Add Upcoming Race</button>
                                </form>
                                 <div className="space-y-4 max-h-[32rem] overflow-y-auto pr-2">
                                    {upcomingRaces.length > 0 ? upcomingRaces.map(race => {
                                            const isPast = new Date(race.date) < new Date();
                                            return (
                                            <div id={`upcoming-card-${race.id}`} key={race.id} className="bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 rounded-lg transition-all hover:shadow-md dark:hover:border-gray-600 overflow-hidden relative">
                                                {isPast && (
                                                    <button onClick={() => handleOpenCompleteModal(race)} className="bg-green-100 dark:bg-green-800/20 text-green-800 dark:text-green-300 w-full p-2 flex items-center justify-center text-sm font-semibold hover:bg-green-200 dark:hover:bg-green-800/40 transition-colors">
                                                        Mark as complete?
                                                        <CheckSquare size={18} className="ml-2" />
                                                    </button>
                                                )}
                                                {editingUpcomingRaceId === race.id ? (
                                                    <div className="p-4 space-y-3">
                                                        <input type="text" value={editingUpcomingRaceData.name} onChange={(e) => setEditingUpcomingRaceData({...editingUpcomingRaceData, name: e.target.value})} className="w-full bg-white dark:bg-gray-600 p-2 rounded border-slate-300 dark:border-gray-500"/>
                                                        <div className="grid grid-cols-6 gap-4">
                                                            <div className={`col-span-2 grid gap-4 ${showCustomEditDistance ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                                                <select value={showCustomEditDistance ? 'Custom' : editingUpcomingRaceData.distance} 
                                                                    onChange={e => {
                                                                        const val = e.target.value;
                                                                        setShowCustomEditDistance(val === 'Custom');
                                                                        setEditingUpcomingRaceData({...editingUpcomingRaceData, distance: val === 'Custom' ? '' : val});
                                                                    }}
                                                                    className="w-full bg-white dark:bg-gray-600 p-2 rounded border-slate-300 dark:border-gray-500">
                                                                    {STANDARD_DISTANCES.map(d => <option key={d} value={d}>{d}</option>)}
                                                                    <option value="Custom">Custom</option>
                                                                </select>
                                                                {showCustomEditDistance && <input type="text" value={editingUpcomingRaceData.distance} onChange={e => setEditingUpcomingRaceData({...editingUpcomingRaceData, distance: e.target.value})} placeholder="Custom" className="w-full bg-white dark:bg-gray-600 p-2 rounded border-slate-300 dark:border-gray-500"/>}
                                                            </div>
                                                            <input type="text" value={editingUpcomingRaceData.goalTime} onChange={(e) => setEditingUpcomingRaceData({...editingUpcomingRaceData, goalTime: e.target.value})} placeholder="Goal Time" className="col-span-2 w-full bg-white dark:bg-gray-600 p-2 rounded border-slate-300 dark:border-gray-500"/>
                                                            <div className="relative col-span-2">
                                                                <input type="date" value={editingUpcomingRaceData.date} onChange={(e) => setEditingUpcomingRaceData({...editingUpcomingRaceData, date: e.target.value})} className={`w-full bg-white dark:bg-gray-600 p-2 rounded border-slate-300 dark:border-gray-500 ${!editingUpcomingRaceData.date ? 'text-slate-400' : 'dark:text-white'}`}/>
                                                            </div>
                                                        </div>
                                                        <div className="relative">
                                                            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18}/>
                                                            <input type="url" placeholder="Race Website Link (Optional)" value={editingUpcomingRaceData.link} onChange={(e) => setEditingUpcomingRaceData({...editingUpcomingRaceData, link: e.target.value})} className="w-full bg-white dark:bg-gray-600 p-2 rounded border-slate-300 dark:border-gray-500 pl-10"/>
                                                        </div>
                                                        <textarea value={editingUpcomingRaceData.info} onChange={(e) => setEditingUpcomingRaceData({...editingUpcomingRaceData, info: e.target.value})} className="w-full bg-white dark:bg-gray-600 p-2 rounded h-20 border-slate-300 dark:border-gray-500"/>
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => handleSaveUpcomingRace(race.id)} className="p-2 rounded-full text-white bg-green-500 hover:bg-green-600"><Save size={18}/></button>
                                                            <button onClick={() => setEditingUpcomingRaceId(null)} className="p-2 rounded-full text-slate-600 bg-slate-200 hover:bg-slate-300"><X size={18}/></button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="p-4">
                                                        <div className="flex justify-between items-start gap-4">
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-bold text-lg text-slate-800 dark:text-slate-100 truncate">{race.name}</p>
                                                                <p className="sm:col-span-2 flex items-center text-sm text-slate-500 dark:text-slate-400 mt-1"><Calendar size={14} className="mr-2 text-indigo-500 dark:text-indigo-400"/>{race.date ? new Date(race.date + 'T00:00:00').toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' }) : 'Date TBD'}</p>
                                                            </div>
                                                            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                                                {isPast && <button onClick={() => handleOpenCompleteModal(race)} className="text-slate-400 hover:text-green-500 transition-colors p-2 rounded-full hover:bg-green-50 dark:hover:bg-green-500/20" aria-label="Mark as complete"><CheckSquare size={18}/></button>}
                                                                <button onClick={() => handleInitiateShare(race, 'upcoming')} className="text-slate-400 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors p-2 rounded-full hover:bg-indigo-50 dark:hover:bg-gray-600"><Share2 size={18}/></button>
                                                                {race.link && <a href={race.link} target="_blank" rel="noopener noreferrer" className="text-slate-400 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors p-2 rounded-full hover:bg-indigo-50 dark:hover:bg-gray-600" aria-label="Race Website"><LinkIcon size={18}/></a>}
                                                                <button onClick={() => handleStartEditUpcomingRace(race)} className="text-slate-400 dark:text-slate-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors p-2 rounded-full hover:bg-yellow-50 dark:hover:bg-yellow-500/20"><Edit size={18}/></button>
                                                                <button onClick={() => handleDeleteUpcomingRace(race.id)} className="text-slate-400 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-500/20"><Trash2 size={18}/></button>
                                                            </div>
                                                        </div>
                                                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-slate-600 dark:text-slate-300 text-sm">
                                                            <p className="flex items-center"><Flag size={16} className="mr-2 text-indigo-500 dark:text-indigo-400"/><strong>Distance:</strong><span className="ml-2">{race.distance || 'N/A'}</span></p>
                                                            <p className="flex items-center"><Target size={16} className="mr-2 text-indigo-500 dark:text-indigo-400"/><strong>Goal:</strong><span className="ml-2">{race.goalTime || 'N/A'}</span></p>
                                                            {race.info && <p className="col-span-full flex items-start mt-1"><Info size={16} className="mr-2 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0"/><strong>Info:</strong><span className="ml-2">{race.info}</span></p>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}) : <p className="text-slate-400 dark:text-slate-500 text-center py-8">No upcoming races planned.</p>}
                                </div>
                            </section>
                        </main>
                    </>
                ) : (
                    <div className="text-center py-20">
                        <h2 className="text-2xl font-bold text-slate-700">Welcome to Benedict Runs!</h2>
                        <p className="text-slate-500 mt-2">Please log in or sign up to track your races.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Personal Records Component ---
function PersonalRecords({ records }) {
    return (
        <section className="bg-white dark:bg-gray-800/50 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold mb-5 flex items-center">
                <Award className="mr-3 text-amber-500" />Personal Records
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {STANDARD_DISTANCES.map(distance => {
                    const record = records[distance];
                    return (
                        <div key={distance} className="bg-slate-50 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-700 p-4 rounded-lg">
                            <h3 className="font-bold text-indigo-600 dark:text-indigo-400">{distance}</h3>
                            {record ? (
                                <div className="mt-2 text-sm">
                                    <p className="font-semibold text-2xl text-slate-700 dark:text-slate-200">{record.time}</p>
                                    <p className="text-slate-500 dark:text-slate-400 mt-2 truncate" title={record.name}>{record.name}</p>
                                    <p className="text-slate-400 dark:text-slate-500 text-xs">{record.date ? new Date(record.date + 'T00:00:00').toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' }) : ''}</p>
                                </div>
                            ) : (
                                <p className="mt-2 text-slate-400 dark:text-slate-500">No record set.</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}


// --- Authentication Modals ---
function NewPRModal({ race, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000); 
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md m-4 text-center">
        <Award className="text-amber-500 mx-auto animate-pulse" size={80} />
        <h2 className="text-3xl font-bold mt-4 text-slate-800">New Personal Record!</h2>
        {race && (
            <div className="text-slate-600 mt-4 text-lg">
                <p className="font-semibold">{race.name}</p>
                <p>{race.distance} - <span className="font-bold text-indigo-600">{race.time}</span></p>
            </div>
        )}
        <button onClick={onClose} className="mt-6 w-full bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700">
            Awesome!
        </button>
      </div>
    </div>
  );
}

function ShareModal({ race, type, imageData, imageName, onClose, onShareAsText }) {
    const handleDownload = () => {
        const link = document.createElement('a');
        link.download = imageName;
        link.href = imageData;
        link.click();
        onClose(); 
    };
    
    const handleTextShare = () => {
        let shareText = '';
        if (type === 'completed') {
            shareText = `Check out this race I ran!\nRace: ${race.name}\nDistance: ${race.distance}\nTime: ${race.time}\nDate: ${new Date(race.date + 'T00:00:00').toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' })}`;
        } else { // upcoming
            shareText = `I'm running this race soon!\nRace: ${race.name}\nDistance: ${race.distance}\nGoal Time: ${race.goalTime}\nDate: ${new Date(race.date + 'T00:00:00').toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' })}`;
        }
        
        const textArea = document.createElement("textarea");
        textArea.value = shareText;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            onShareAsText();
        } catch (err) {
            console.error('Failed to copy: ', err);
        }
        document.body.removeChild(textArea);
        onClose();
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl w-full max-w-lg m-4">
                <h2 className="text-2xl font-bold mb-4 dark:text-slate-100">Share Race</h2>
                <div className="my-4 border border-slate-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <img src={imageData} alt="Race card preview" className="w-full h-auto" />
                </div>
                <div className="flex justify-end gap-4">
                    <button onClick={onClose} className="bg-slate-200 text-slate-700 p-3 rounded-lg font-bold hover:bg-slate-300 dark:bg-gray-600 dark:text-slate-200 dark:hover:bg-gray-500">
                        Cancel
                    </button>
                    <button onClick={handleTextShare} className="bg-slate-500 text-white p-3 rounded-lg font-bold hover:bg-slate-600 flex items-center gap-2">
                        <ClipboardCopy size={18}/> Copy Text
                    </button>
                    <button onClick={handleDownload} className="bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2">
                        <Download size={18}/> Download Image
                    </button>
                </div>
            </div>
        </div>
    );
}

function SignUpModal({ onClose, onSwitch }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSignUp = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!username || !password || !name) {
            setError("Name, username and password are required.");
            setLoading(false);
            return;
        }
        
        const emailForAuth = `${username}@benedictruns.app`;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, emailForAuth, password);
            const user = userCredential.user;

            await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}/profile`, "data"), {
                name: name,
                username: username,
                email: email, 
                createdAt: new Date(),
            });

            onClose(); 
        } catch (authError) {
            if (authError.code === 'auth/email-already-in-use') {
                setError("Username is already taken. Please choose another one.");
            } else {
                setError(authError.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md m-4">
                <h2 className="text-2xl font-bold mb-4">Create Account</h2>
                {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg mb-4">{error}</p>}
                <form onSubmit={handleSignUp} className="space-y-4">
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" required className="w-full bg-slate-100 p-3 rounded-lg border-slate-300"/>
                    <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" required className="w-full bg-slate-100 p-3 rounded-lg border-slate-300"/>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (min. 6 characters)" required className="w-full bg-slate-100 p-3 rounded-lg border-slate-300"/>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (Optional, for backup)" className="w-full bg-slate-100 p-3 rounded-lg border-slate-300"/>
                    <div className="flex justify-between items-center gap-4">
                        <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700 disabled:bg-indigo-300">{loading ? 'Creating...' : 'Sign Up'}</button>
                        <button type="button" onClick={onClose} className="w-full bg-slate-200 text-slate-700 p-3 rounded-lg font-bold hover:bg-slate-300">Cancel</button>
                    </div>
                </form>
                <p className="text-center text-sm text-slate-500 mt-6">
                    Already have an account? <button onClick={onSwitch} className="font-semibold text-indigo-600 hover:underline">Log In</button>
                </p>
            </div>
        </div>
    );
}

function LoginModal({ onClose, onSwitch }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const emailForAuth = `${username}@benedictruns.app`;

        try {
            await signInWithEmailAndPassword(auth, emailForAuth, password);
            onClose();
        } catch (authError) {
             switch (authError.code) {
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    setError('Invalid username or password.');
                    break;
                default:
                    setError('An error occurred. Please try again.');
                    break;
            }
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md m-4">
                <h2 className="text-2xl font-bold mb-4">Log In</h2>
                {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg mb-4">{error}</p>}
                <form onSubmit={handleLogin} className="space-y-4">
                    <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" required className="w-full bg-slate-100 p-3 rounded-lg border-slate-300"/>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required className="w-full bg-slate-100 p-3 rounded-lg border-slate-300"/>
                    <div className="flex justify-between items-center gap-4">
                         <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700 disabled:bg-indigo-300">{loading ? 'Logging in...' : 'Log In'}</button>
                        <button type="button" onClick={onClose} className="w-full bg-slate-200 text-slate-700 p-3 rounded-lg font-bold hover:bg-slate-300">Cancel</button>
                    </div>
                </form>
                 <p className="text-center text-sm text-slate-500 mt-6">
                    Don't have an account? <button onClick={onSwitch} className="font-semibold text-indigo-600 hover:underline">Log In</button>
                </p>
            </div>
        </div>
    );
}

function CompleteRaceModal({ race, time, setTime, notes, setNotes, onClose, onComplete }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <form onSubmit={onComplete} className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md m-4">
                <h2 className="text-2xl font-bold mb-2">Complete Race</h2>
                <p className="text-slate-500 mb-4 text-lg">{race.name}</p>
                <div className="space-y-4">
                     <input type="text" value={time} onChange={(e) => setTime(e.target.value)} placeholder="Completion Time (e.g., 45:32)" required className="w-full bg-slate-100 p-3 rounded-lg border-slate-300"/>
                     <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (e.g., weather, how you felt)" className="w-full bg-slate-100 p-3 rounded-lg border-slate-300 h-24 resize-none" />
                </div>
                <div className="flex justify-end gap-4 mt-6">
                    <button type="button" onClick={onClose} className="bg-slate-200 text-slate-700 p-3 rounded-lg font-bold hover:bg-slate-300">
                        Cancel
                    </button>
                    <button type="submit" className="bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700">
                        Add to History
                    </button>
                </div>
            </form>
        </div>
    );
}

function UpdateInfoModal({ userProfile, onClose, onUpdate }) {
    const [name, setName] = useState(userProfile?.name || '');
    const [email, setEmail] = useState(userProfile?.email || '');

    const handleSubmit = (e) => {
        e.preventDefault();
        onUpdate(name, email);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md m-4">
                <h2 className="text-2xl font-bold mb-4 dark:text-slate-100">Update Your Info</h2>
                <div className="space-y-4">
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" required className="w-full bg-slate-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-3 rounded-lg border-slate-300"/>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (Optional, for backup)" className="w-full bg-slate-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-3 rounded-lg border-slate-300"/>
                </div>
                <div className="flex justify-end gap-4 mt-6">
                    <button type="button" onClick={onClose} className="bg-slate-200 text-slate-700 p-3 rounded-lg font-bold hover:bg-slate-300 dark:bg-gray-600 dark:text-slate-200 dark:hover:bg-gray-500">
                        Cancel
                    </button>
                    <button type="submit" className="bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700">
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    );
}

