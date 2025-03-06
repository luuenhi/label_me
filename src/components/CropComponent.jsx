import React, { useRef, useState } from "react";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { imageDb } from "../firebase/firebaseConfig";
import { v4 as uuidv4 } from "uuid";

// Add the dataURLtoFile helper function
const dataURLtoFile = (dataurl, filename) => {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

export default function CropComponent({ imageUrl, onUploadComplete }) {
  // updated to accept onUploadComplete
  const cropperRef = useRef(null);
  const [croppedImage, setCroppedImage] = useState(null);
  // State for file name input
  const [fileName, setFileName] = useState("");

  const onCrop = () => {
    const cropper = cropperRef.current?.cropper;
    const croppedDataUrl = cropper.getCroppedCanvas().toDataURL();
    setCroppedImage(croppedDataUrl);
    console.log(croppedDataUrl);
  };

  const handleUpload = async () => {
    if (croppedImage && fileName) {
      const file = dataURLtoFile(croppedImage, fileName);
      try {
        const uniqueFileName = `${uuidv4()}_${file.name}`;
        const imagePath = `labeled_images/${uniqueFileName}`;
        const imageRef = ref(imageDb, imagePath);
        await uploadBytes(imageRef, file);
        const url = await getDownloadURL(imageRef);
        console.log("Uploading file successful:", url);
        // Pass an object containing the label and URL to onUploadComplete
        if (onUploadComplete) onUploadComplete({ label: fileName, url });
      } catch (error) {
        console.log("Upload error:", error);
      }
    } else {
      console.log("Missing cropped image or file name.");
    }
  };

  return (
    <>
      <Cropper
        src={imageUrl}
        style={{ height: 400, width: "100%" }}
        // Cropper.js options
        initialAspectRatio={16 / 9}
        guides={true}
        crop={onCrop}
        ref={cropperRef}
      />
      {/* Render cropped image if available */}
      {croppedImage && (
        <div>
          <h2>Cropped Image:</h2>
          <img src={croppedImage} alt="Cropped" />
        </div>
      )}
      {/* New input and button for upload */}
      <div>
        <input
          type="text"
          placeholder="Enter file name"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
        />
        <button onClick={handleUpload}>Upload Cropped Image</button>
      </div>
    </>
  );
}
