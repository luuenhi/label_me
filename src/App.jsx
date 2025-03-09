import React, { useRef } from "react";
import FirebaseImageUpload from "./firebase/FirebaseImageUpload";
import Label from "./components/Label";

function App() {
  const handleUploadSuccess = (fileUrls) => {
    // Update imageUrl in Label component
    // Assuming you have a reference to the Label component
    // You can use a state management solution like Redux or Context API for better state management
    // For now, we will use a simple state update
    labelRef.current.handleUpload(fileUrls);
  };

  const labelRef = useRef(null);

  return (
    <div className="App">
      <FirebaseImageUpload onUploadSuccess={handleUploadSuccess} />
      <Label ref={labelRef} />
    </div>
  );
}

export default App;
