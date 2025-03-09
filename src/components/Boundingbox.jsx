import React, { useRef, useState } from "react";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css"; // Import CSS của cropper
import "./Boundingbox.css"; // Import the CSS file

const Boundingbox = ({ onCropComplete, onUploadCroppedImage }) => {
  const cropperRef = useRef(null);
  const [image, setImage] = useState(""); // Ảnh gốc
  const [croppedImage, setCroppedImage] = useState("");
  const [cropBox, setCropBox] = useState(null); // Lưu vị trí và kích thước của crop box

  // Khi người dùng chọn ảnh
  const onImageChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();

      reader.onload = () => {
        setImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Cập nhật bounding box khi crop thay đổi
  const onCropMove = () => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      const cropBoxData = cropper.getCropBoxData();
      setCropBox(cropBoxData);
    }
  };

  // Cắt ảnh
  const cropImage = () => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      const croppedCanvas = cropper.getCroppedCanvas();
      setCroppedImage(croppedCanvas.toDataURL());

      // Lấy tọa độ của điểm góc trên trái và dưới phải
      const cropBoxData = cropper.getCropBoxData();
      const coordinates = {
        topLeft: { x: cropBoxData.left, y: cropBoxData.top },
        bottomRight: {
          x: cropBoxData.left + cropBoxData.width,
          y: cropBoxData.top + cropBoxData.height,
        },
      };

      // Gọi hàm callback để truyền dữ liệu ra ngoài
      onCropComplete(coordinates);
      setCropBox(cropBoxData); // Update cropBox state to display bounding box
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>React Cropper Example</h2>

      {/* Input chọn ảnh */}
      <input
        type="file"
        accept="image/*"
        onChange={onImageChange}
        style={{ marginBottom: "20px" }}
      />

      {/* Cropper Component */}
      <div style={{ position: "relative" }}>
        {image && (
          <Cropper
            src={image}
            style={{ height: 400, width: "100%" }}
            aspectRatio={16 / 9} // Tùy chỉnh tỉ lệ crop
            guides={false} // Tắt guides mặc định
            ref={cropperRef}
            cropBoxResizable={true} // Cho phép resize box crop
            viewMode={1} // Giới hạn crop trong vùng ảnh
            cropmove={onCropMove} // Lắng nghe sự kiện crop di chuyển
          />
        )}

        {/* Hiển thị Bounding Box màu đỏ theo crop box */}
        {cropBox && (
          <div
            style={{
              position: "absolute",
              top: `${cropBox.top}px`,
              left: `${cropBox.left}px`,
              width: `${cropBox.width}px`,
              height: `${cropBox.height}px`,
              border: "2px solid red",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* Buttons */}
      <div style={{ marginTop: "20px" }}>
        <button onClick={cropImage} className="button">
          Crop Image
        </button>
        {croppedImage && (
          <button
            onClick={() => onUploadCroppedImage(croppedImage)}
            className="button"
          >
            Upload Cropped Image
          </button>
        )}
      </div>

      {/* Hiển thị ảnh đã crop */}
      {croppedImage && (
        <div>
          <h3>Cropped Image</h3>
          <img
            src={croppedImage}
            alt="Cropped"
            style={{ maxWidth: "100%", marginTop: "10px" }}
          />
        </div>
      )}
    </div>
  );
};

export default Boundingbox;
