
import React from "react";
import FirebaseImageUpload from "./firebase/FirebaseImageUpload";
import Label from "./components/Label";

function App() {
  return (
    <div className="App">
      <h1>Uplpoad to Firebase</h1>
      <FirebaseImageUpload />
      <Label />
    </div>
  );
}

export default App;
