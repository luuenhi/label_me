import { useState, useEffect } from "react";
import { imageDb, firestoreDb } from "../firebase/firebaseConfig";
import { listAll, ref, getDownloadURL } from "firebase/storage";
import { doc, getDoc, setDoc } from "firebase/firestore";

function Label() {
  const [imageList, setImageList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageUrl, setImageUrl] = useState("");
  const [label, setLabel] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false); // Popup xác nhận tải CSV
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageInfo, setImageInfo] = useState({ label: "", labeledBy: "" });
  const [labeledData, setLabeledData] = useState({}); // Lưu nhãn trong phiên

  useEffect(() => {
    loadImageList();
  }, []);

  const loadImageList = async () => {
    try {
      const storageRef = ref(imageDb, "images/");
      const result = await listAll(storageRef);
      setImageList(result.items);
      if (result.items.length > 0) {
        loadImage(result.items[0], 0);
      }
    } catch (error) {
      console.error("Lỗi khi tải danh sách ảnh:", error);
    }
  };

  const loadImage = async (imageRef, index) => {
    try {
      const url = await getDownloadURL(imageRef);
      setImageUrl(url);
      setCurrentIndex(index);
      setSelectedImage(imageRef);
      checkLabeledStatus(imageRef.name);
    } catch (error) {
      console.error("Lỗi khi tải ảnh:", error);
    }
  };

  const checkLabeledStatus = async (imageName) => {
    try {
      const docRef = doc(firestoreDb, "labeled_images", "labels");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data()[imageName]) {
        const labeledData = docSnap.data()[imageName];
        setImageInfo({ label: labeledData.label, labeledBy: labeledData.labeledBy });
      } else {
        setImageInfo({ label: "", labeledBy: "" });
      }
    } catch (error) {
      console.error("Lỗi khi kiểm tra trạng thái label:", error);
    }
  };

  const handleSaveLabel = async () => {
    if (!label.trim()) {
      alert("Vui lòng nhập nhãn!");
      return;
    }
    try {
      const docRef = doc(firestoreDb, "labeled_images", "labels");
      const docSnap = await getDoc(docRef);
      let data = docSnap.exists() ? docSnap.data() : {};

      // Cập nhật nhãn vào Firestore
      data[selectedImage.name] = {
        label,
        labeledBy: "user@email.com",
        timestamp: new Date().toISOString(),
      };
      await setDoc(docRef, data);

      // Lưu nhãn vào state để tạo CSV sau này
      setLabeledData((prev) => ({
        ...prev,
        [selectedImage.name]: {
          label,
          labeledBy: "user@email.com",
          timestamp: new Date().toISOString(),
        },
      }));

      alert("Lưu thành công!");
      setImageInfo({ label, labeledBy: "user@email.com" });
      setLabel("");
      setShowPopup(false);
    } catch (error) {
      console.error("Lỗi khi lưu nhãn:", error);
    }
  };

  const handlePrevImage = () => {
    if (currentIndex > 0) {
      loadImage(imageList[currentIndex - 1], currentIndex - 1);
    }
  };

  const handleNextImage = () => {
    if (currentIndex < imageList.length - 1) {
      loadImage(imageList[currentIndex + 1], currentIndex + 1);
    }
  };

  const handleStopLabeling = () => {
    setShowConfirmPopup(true); // Hiển thị popup xác nhận khi ấn dừng
  };

  const confirmDownloadCSV = () => {
    setShowConfirmPopup(false);
    if (Object.keys(labeledData).length === 0) {
      alert("Chưa có ảnh nào được gán nhãn trong phiên này!");
      return;
    }
    downloadCSV(labeledData);
  };

  const downloadCSV = (data) => {
    const csvRows = [];
    const headers = ["Image Name", "Label", "Labeled By", "Timestamp"];
    csvRows.push(headers.join(","));

    Object.keys(data).forEach((imageName) => {
      const { label, labeledBy, timestamp } = data[imageName];
      csvRows.push([imageName, label, labeledBy, timestamp].join(","));
    });

    const csvContent = csvRows.join("\n");
    const csvBlob = new Blob([csvContent], { type: "text/csv" });

    // Tạo URL tải file CSV
    const csvUrl = URL.createObjectURL(csvBlob);
    const link = document.createElement("a");
    link.href = csvUrl;
    link.download = `labels_${new Date().toISOString()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert("Đã tải file CSV!");
  };

  return (
    <div>
      <h1>Gán nhãn ảnh</h1>
      {imageUrl && (
        <div className="label-area">
          <img src={imageUrl} alt="Ảnh đang label" width="300" />
          <p><b>File:</b> {selectedImage?.name}</p>
          <div className="navigation-container">
            <button onClick={handlePrevImage} disabled={currentIndex === 0}>
              {"<"} Ảnh trước
            </button>
            <span className="image-index">{currentIndex + 1} / {imageList.length}</span>
            <button onClick={handleNextImage} disabled={currentIndex === imageList.length - 1}>
              Ảnh sau {">"}
            </button>
          </div>
          <p><b>Trạng thái:</b> {imageInfo.label ? `${imageInfo.label} - ${imageInfo.labeledBy}` : "Chưa label"}</p>
          <button onClick={() => setShowPopup(true)} disabled={imageInfo.label !== ""}>
            Gán nhãn
          </button>
          <button onClick={handleStopLabeling} className="stop-button">
            Dừng Label
          </button>
        </div>
      )}

      {showConfirmPopup && (
        <div className="popup">
          <div className="popup-content">
            <h2>Bạn có muốn tải file CSV?</h2>
            <button onClick={confirmDownloadCSV}>Có</button>
            <button onClick={() => setShowConfirmPopup(false)}>Không</button>
          </div>
        </div>
      )}

      {showPopup && (
        <div className="popup">
          <div className="popup-content">
            <h2>Gán nhãn ảnh</h2>
            <input
              type="text"
              placeholder="Nhập nhãn..."
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <button onClick={handleSaveLabel}>Lưu nhãn</button>
            <button onClick={() => setShowPopup(false)}>Đóng</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Label;
