import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './App.css';
import { FaPaperPlane, FaVideo, FaUpload, FaStar, FaUser } from 'react-icons/fa';

// Initialize Socket.IO client
const socket = io('http://localhost:5000');

function App() {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [contacts, setContacts] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [setIsFileUploadVisible] = useState(false);
  const [file, setFile] = useState(null);
  const [videoCall, setVideoCall] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const videoRef = useRef(null);

  useEffect(() => {
    // Fetch messages and contacts on load
    axios.get('http://localhost:5000/messages', {
      headers: { 'Authorization': localStorage.getItem('token') },
    }).then((response) => setMessages(response.data));

    axios.get('http://localhost:5000/users', {
      headers: { 'Authorization': localStorage.getItem('token') },
    }).then((response) => setContacts(response.data));

    axios.get('http://localhost:5000/favorites', { // Replace 1 with the actual user ID
      headers: { 'Authorization': localStorage.getItem('token') },
    }).then((response) => setFavorites(response.data));

    // Set up Socket.IO listeners
    socket.on('receiveMessage', (newMessage) => {
      setMessages((prevMessages) => [...prevMessages, newMessage]);
    });

    socket.on('remoteStream', (stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    });

    return () => {
      socket.off('receiveMessage');
      socket.off('remoteStream');
    };
  }, []);

  const sendMessage = () => {
    if (selectedContact) {
      const senderId = 1; // Replace with actual sender ID
      const receiverId = selectedContact.id;
      socket.emit('sendMessage', { senderId, receiverId, content: message });
      setMessage('');
    }
  };

  const handleFileUpload = (event) => {
    const uploadedFile = event.target.files[0];
    setFile(uploadedFile);
    setIsFileUploadVisible(true);
  };

  const uploadFile = () => {
    const formData = new FormData();
    formData.append('file', file);
    axios.post('http://localhost:5000/upload', formData, {
      headers: { 'Authorization': localStorage.getItem('token') },
    }).then(response => {
      console.log('File uploaded:', response.data);
      setIsFileUploadVisible(false);
      setFile(null);
    }).catch(error => {
      console.error('File upload error:', error);
    });
  };

  const startVideoCall = async () => {
    try {
      // Get local media stream
      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(localStream);

      // Set up peer connection
      const peerConnection = new RTCPeerConnection();

      // Add local tracks to the peer connection
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        if (videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
        }
      };

      // Signal new call
      socket.emit('startCall');

      // Handle incoming offer
      socket.on('offer', async (offer) => {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', answer);
      });

      // Handle incoming answer
      socket.on('answer', async (answer) => {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      });

      // Handle incoming ICE candidates
      socket.on('candidate', (candidate) => {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      });

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('candidate', event.candidate);
        }
      };

      setVideoCall(true);
    } catch (error) {
      console.error('Video call error:', error);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div id="app-container">
      <div id="header">Chat Application</div>
      <div id="chat-container">
        <div id="sidebar">
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
        <div id="chat-area">
          {selectedContact && (
            <>
              <div id="message-list">
                {messages
                  .filter(msg => msg.sender_id === selectedContact.id || msg.receiver_id === selectedContact.id)
                  .map((msg, index) => (
                    <div
                      key={index}
                      className={`message ${msg.sender_id === 1 ? 'sent' : 'received'}`}
                    >
                      {msg.content}
                    </div>
                  ))}
              </div>
              <div id="input-area">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message..."
                />
                <button onClick={sendMessage}><FaPaperPlane /></button>
                <div className="file-upload">
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
                <button onClick={startVideoCall}><FaVideo /></button>
              </div>
            </>
          )}
        </div>
      </div>
      {videoCall && (
        <div className="video-call">
          <video ref={videoRef} autoPlay playsInline></video>
          <div className="local-video">
            <video srcObject={localStream} autoPlay muted playsInline></video>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
