import React, { useEffect, useRef } from 'react';

const VideoCall = ({ call, onEndCall }) => {
    const localVideoRef = useRef();
    const remoteVideoRef = useRef();

    useEffect(() => {
        const startCall = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                localVideoRef.current.srcObject = stream;

                if (call) {
                    call.on('stream', (remoteStream) => {
                        remoteVideoRef.current.srcObject = remoteStream;
                    });
                }
            } catch (error) {
                console.error('Error starting video call:', error);
            }
        };

        startCall();
    }, [call]);

    return (
        <div className="video-call">
            <h3>Video Call</h3>
            <div className="video-container">
                <video ref={localVideoRef} autoPlay playsInline muted />
                <video ref={remoteVideoRef} autoPlay playsInline />
            </div>
            <button className="btn btn-danger" onClick={onEndCall}>End Call</button>
        </div>
    );
};

export default VideoCall;
