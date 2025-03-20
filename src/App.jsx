import React, { useState, useRef } from "react";
import Login from "./components/Login";
import Signup from "./components/Signup";
import Label from "./components/Label";
import FirebaseImageUpload from "./firebase/FirebaseImageUpload";

const App = () => {
  const [user, setUser] = useState(null);
  const [showSignup, setShowSignup] = useState(false);

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
  };

  const handleUploadSuccess = (fileUrls) => {
    labelRef.current.handleUpload(fileUrls);
  };

  const labelRef = useRef(null);

  return (
    <div className="App">
      {user ? (
        <>
          <Label ref={labelRef} user={user} />
          <FirebaseImageUpload onUploadSuccess={handleUploadSuccess} />
        </>
      ) : showSignup ? (
        <Signup />
      ) : (
        <Login onLogin={handleLogin} />
      )}
      {!user && (
        <button onClick={() => setShowSignup(!showSignup)}>
          {showSignup ? "Login" : "Sign Up"}
        </button>
      )}
    </div>
  );
};

export default App;
