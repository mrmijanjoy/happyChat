import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './App.css';
import { FaPaperPlane, FaVideo, FaUpload, FaStar, FaUser } from 'react-icons/fa';
import VideoCall from './components/VideoCall';  

const socket = io('http://localhost:5000');

function App() {
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState('');
    const [contacts, setContacts] = useState([]);
    const [favorites, setFavorites] = useState([]);
    const [selectedContact, setSelectedContact] = useState(null);
    const [file, setFile] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [call, setCall] = useState(null);
    const [inCall, setInCall] = useState(false);

    useEffect(() => {
        axios.get('http://localhost:5000/messages', {
            headers: { 'Authorization': localStorage.getItem('token') },
        }).then((response) => setMessages(response.data));

        axios.get('http://localhost:5000/users', {
            headers: { 'Authorization': localStorage.getItem('token') },
        }).then((response) => setContacts(response.data));

        axios.get('http://localhost:5000/favorites', {
            headers: { 'Authorization': localStorage.getItem('token') },
        }).then((response) => setFavorites(response.data));

        socket.on('receiveMessage', (newMessage) => {
            if (selectedContact &&
                ((newMessage.sender_id === selectedContact.id && newMessage.receiver_id === 1) ||
                (newMessage.sender_id === 1 && newMessage.receiver_id === selectedContact.id))) {
                setMessages((prevMessages) => [...prevMessages, newMessage]);
            }
        });

        socket.on('call', handleStartCall);

        return () => {
            socket.off('receiveMessage');
            socket.off('call');
        };
    }, [selectedContact]);

    //send message
    const sendMessage = () => {
        if (selectedContact) {
            const senderId = 1; 
            const receiverId = selectedContact.id;
            const content = message;

            socket.emit('sendMessage', { senderId, receiverId, content });

            axios.post('http://localhost:5000/messages', { senderId, receiverId, content }, {
                headers: { 'Authorization': localStorage.getItem('token') },
            }).then(() => setMessage('')).catch((error) => console.error('Error sending message:', error));
        }
    };

    //file upload
    const handleFileUpload = (event) => {
        const uploadedFile = event.target.files[0];
        setFile(uploadedFile);
    };

    const uploadFile = () => {
        const formData = new FormData();
        formData.append('file', file);
        axios.post('http://localhost:5000/upload', formData, {
            headers: { 'Authorization': localStorage.getItem('token') },
        }).then(response => {
            console.log('File uploaded:', response.data);
            setFile(null);
        }).catch(error => console.error('File upload error:', error));
    };

    //video call
    const startVideoCall = async () => {
        try {
            const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

            const peerConnection = new RTCPeerConnection();

            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            peerConnection.ontrack = (event) => {
                if (call) {
                    call.srcObject = event.streams[0];
                }
            };

            socket.emit('startCall', { peerConnection });

            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('candidate', event.candidate);
                }
            };

            setCall(peerConnection);
            setInCall(true);
        } catch (error) {
            console.error('Video call error:', error);
        }
    };

    const handleStartCall = (callData) => {
        setCall(callData);
        setInCall(true);
    };

    const handleEndCall = () => {
        if (call) {
            call.close();
        }
        setCall(null);
        setInCall(false);
    };

    //search
    const filteredContacts = contacts.filter(contact =>
        contact.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div id="app-container">
            <div id="header">Chat Application</div>
            <div id="chat-container">
                <div id="sidebar">  //============================================receiver side
                    <h2>Contacts</h2>
                    <div className="search-bar">
                        <input
                            type="text"
                            placeholder="Search contacts"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <h3><FaStar /> Favorites</h3>
                    <ul>
                        {favorites.map(contact => (
                            <li key={contact.id} onClick={() => setSelectedContact(contact)}>
                                <FaUser /> {contact.username}
                            </li>
                        ))}
                    </ul>
                    <h3><FaUser /> All Contacts</h3>
                    <ul>
                        {filteredContacts.map(contact => (
                            <li key={contact.id} onClick={() => setSelectedContact(contact)}>
                                <FaUser /> {contact.username}
                            </li>
                        ))}
                    </ul>
                </div>
                <div id="chat-area"> //===================================================inbox
                    {selectedContact && (
                        <>
                            <div id="message-list">
                                {messages
                                    .filter(msg =>
                                        (msg.sender_id === selectedContact.id && msg.receiver_id === 1) ||
                                        (msg.sender_id === 1 && msg.receiver_id === selectedContact.id)
                                    )
                                    .map((msg, index) => (
                                        <div
                                            key={index}
                                            className={`message ${msg.sender_id === 1 ? 'sent' : 'received'}`}
                                        >
                                            {msg.content}
                                        </div>
                                    ))}
                            </div>
                            <div id="input-area"> //===================================================message box
                                <input
                                    type="text"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Type a message..."
                                />
                                <button onClick={sendMessage}><FaPaperPlane /></button>
                                <div className="file-upload"> //===========================================file upload
                                    <input
                                        type="file"
                                        id="file-upload-input"
                                        onChange={handleFileUpload}
                                        style={{ display: 'none' }}
                                    />
                                    <label htmlFor="file-upload-input" className="file-upload-label">
                                        <FaUpload />
                                    </label>
                                </div>
                                <button onClick={startVideoCall}><FaVideo /></button> //====================video call
                            </div>
                        </>
                    )}
                </div>
            </div>
            {inCall && (
                <VideoCall call={call} onEndCall={handleEndCall} />
            )}
        </div>
    );
}

export default App;
