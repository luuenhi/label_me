import React, { useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { imageDb } from "./firebaseConfig";
import { v4 as uuidv4 } from "uuid";

function FirebaseImageUpload() {
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);

  const handleUpload = async () => {
    if (!image) return;

    const imageRef = ref(imageDb, `images/${image.name + uuidv4()}`);
    try {
      console.log("====================================");
      console.log("image", image);
      console.log("imageRef", imageRef);

      console.log("====================================");
      const snapshot = await uploadBytes(imageRef, image);
      const url = await getDownloadURL(snapshot.ref);
      setImageUrl(url);
      console.log("Upload thành công:", url);
    } catch (error) {
      console.error("Lỗi upload:", error);
    }
  };

  return (
    <div>
      <input type="file" onChange={(e) => setImage(e.target.files[0])} />
      <button onClick={handleUpload}>Upload Ảnh</button>
      {imageUrl && (
        <img src={imageUrl} alt="Uploaded" style={{ marginTop: "20px" }} />
      )}
    </div>
  );
}

export default FirebaseImageUpload;
