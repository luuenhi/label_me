import React, { useState, useRef, useEffect } from "react";
import { ref, uploadBytes, getDownloadURL, listAll } from "firebase/storage";
import { imageDb } from "./firebaseConfig";
import { v4 as uuidv4 } from "uuid";
import "./FirebaseImageUpload.css";

function FirebaseImageUpload({ onUploadSuccess }) {
  const [images, setImages] = useState([]);
  const imagesRef = useRef([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const newFiles = Array.from(event.target.files);
    setImages((prevImages) => [...prevImages, ...newFiles]);
    imagesRef.current = [...imagesRef.current, ...newFiles];
  };

  const uploadFiles = async () => {
    setUploading(true);
    try {
      const uploadedImages = [];

      const uploadTasks = imagesRef.current.map(async (image) => {
        const fileName = `${uuidv4()}_${image.name}`;
        const imagePath = `multipleFiles/${fileName}`;
        const imageRef = ref(imageDb, imagePath);

        await uploadBytes(imageRef, image);
        const url = await getDownloadURL(imageRef);

        uploadedImages.push({
          name: fileName,
          fullPath: imageRef.fullPath,
          url,
        });
      });

      await Promise.all(uploadTasks);

      setMessage(`Upload ${uploadedImages.length} success!`);
      setTimeout(() => setMessage(""), 5000);
      setImages([]);
      imagesRef.current = [];
      fileInputRef.current.value = null;

      if (onUploadSuccess) {
        onUploadSuccess(uploadedImages.map((img) => img.url));
      }
    } catch (error) {
      console.error("Upload Error:", error);
      setMessage("Upload error!: " + error.message);
    }

    setUploading(false);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (imagesRef.current.length > 0) {
          uploadFiles();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="upload-container">
      <div className="upload-controls">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
        />
        <button onClick={uploadFiles} disabled={uploading}>
          {uploading ? "Uploading..." : "Submit"}
        </button>
        {message && <p className="message">{message}</p>}
      </div>
    </div>
  );
}

export default FirebaseImageUpload;
