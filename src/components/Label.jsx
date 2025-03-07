import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { imageDb, firestoreDb } from "../firebase/firebaseConfig";
import { listAll, ref, getDownloadURL, deleteObject } from "firebase/storage"; // Ensure correct import
import { deleteField, doc, getDoc, setDoc } from "firebase/firestore";
import { uploadBytes } from "firebase/storage";
import "./Label.css";
import { updateDoc } from "firebase/firestore";
import { collection, getDocs } from "firebase/firestore";
import { getStorage, getMetadata } from "firebase/storage";
import CropComponent from "./CropComponent";
const Label = forwardRef((props, sref) => {
  const [imageList, setImageList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageUrl, setImageUrl] = useState("");
  const [label, setLabel] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageInfo, setImageInfo] = useState({ label: "", labeledBy: "" });
  const [latestLabeled, setLatestLabeled] = useState([]);
  const inputRef = useRef(null);
  const [allLabeledImages, setAllLabeledImages] = useState([]); // Danh sách ảnh đã labeled
  const [pageIndex, setPageIndex] = useState(0); // Trang hiện tại
  const [totalImages, setTotalImages] = useState(0);
  const [showCrop, setShowCrop] = useState(false);

  useImperativeHandle(sref, () => ({
    handleUpload: (fileUrls) => {
      setImageUrl(fileUrls);
      // setImageList((prevList) => [...prevList, ...fileUrls]);
      loadImageList();
    },
  }));
  useEffect(() => {
    loadImageList();
    fetchAllLabeledImages();
  }, []);

  useEffect(() => {
    if (imageList.length > 0) {
      loadImage(imageList[imageList.length - 1], 0);
    } else {
      setImageUrl(""); // Nếu hết ảnh, ẩn ảnh hiện tại
      setSelectedImage(null);
    }
  }, [imageList]); // Chạy mỗi khi imageList thay đổi

  useEffect(() => {
    const fetchImages = async () => {
      const storage = getStorage();
      const storageRef = ref(imageDb, "images/"); // Ensure correct usage
      try {
        const result = await listAll(storageRef);
        const urls = await Promise.all(
          result.items.map((item) => getDownloadURL(item))
        );
        // setImageUrls(urls);
      } catch (error) {
        console.error("Lỗi tải ảnh từ Firebase:", error);
      }
    };
    fetchImages();
  }, []);

  const loadImageList = async () => {
    try {
      const storageRef = ref(imageDb, "multipleFiles/");
      const result = await listAll(storageRef);
      console.log("====================================");
      console.log("result hehe", result);
      console.log("====================================");
      // Lấy metadata của từng file và sắp xếp theo thời gian chỉnh sửa cuối cùng
      const filesWithMetadata = await Promise.all(
        result.items.map(async (item) => {
          const metadata = await getMetadata(item); // Lấy metadata của từng file
          return {
            ref: item,
            lastModified: metadata.updated, // Thời gian cập nhật cuối cùng
          };
        })
      );

      // Sắp xếp danh sách file theo lastModified (mới nhất trước)
      filesWithMetadata.sort((a, b) => b.lastModified - a.lastModified);

      // Cập nhật danh sách file đã sắp xếp
      setImageList(filesWithMetadata.map((file) => file.ref));
      setTotalImages(filesWithMetadata.length); // Cập nhật số lượng ảnh

      if (filesWithMetadata.length > 0) {
        loadImage(filesWithMetadata[0].ref, 0); // Tải ảnh đầu tiên trong danh sách đã sắp xếp
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
      setTimeout(() => inputRef.current?.focus(), 100);
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
        setImageInfo({
          label: labeledData.label,
          labeledBy: labeledData.labeledBy,
        });
        setLabel(labeledData.label);
      } else {
        setImageInfo({ label: "", labeledBy: "" });
        setLabel("");
      }
    } catch (error) {
      console.error("Lỗi khi kiểm tra trạng thái label:", error);
    }
  };

  const moveImage = async (imagePath, label) => {
    try {
      const docRef = doc(firestoreDb, "labeled_images", "labels");

      await updateDoc(docRef, {
        [imagePath]: {
          label,
          labeledBy: "user@email.com", // (Có thể lấy từ auth nếu có)
          timestamp: new Date().toISOString(),
        },
      });

      console.log(`Đã lưu nhãn cho ảnh: ${imagePath}`);
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

  const handleSaveLabel = async (img = selectedImage, newLabel = label) => {
    if (!img || !newLabel.trim()) {
      alert("Vui lòng nhập nhãn!");
      return;
    }

    try {
      const oldPath = `multipleFiles/${img.name}`;
      const newPath = `labeled_images/${img.name}`;
      const oldImageRef = ref(imageDb, oldPath);
      const newImageRef = ref(imageDb, newPath);
      const oldImageUrl = await getDownloadURL(oldImageRef);
      const response = await fetch(oldImageUrl);
      const blob = await response.blob();

      // ✅ Cập nhật danh sách UI trước khi lưu Firebase
      const newLabeledData = {
        name: img.name,
        url: oldImageUrl,
        label: newLabel,
      };
      setLatestLabeled((prev) => [newLabeledData, ...prev].slice(0, 6));
      setAllLabeledImages((prev) => [newLabeledData, ...prev]);

      // 🕒 Thực hiện các thao tác Firebase nhưng không ảnh hưởng UI
      await uploadBytes(newImageRef, blob);
      await setDoc(doc(firestoreDb, "labeled_images", img.name), {
        label: newLabel.trim(),
        labeledBy: "user@email.com",
        imagePath: newPath,
        timestamp: new Date().toISOString(),
      });

      await deleteObject(oldImageRef);
      setImageList((prev) => prev.filter((image) => image.name !== img.name));

      // Chuyển sang ảnh tiếp theo
      handleNextImage();
      setLabel("");
    } catch (error) {
      console.error("Lỗi khi xử lý ảnh:", error);
    }
  };

  const fetchAllLabeledImages = async () => {
    try {
      const collectionRef = collection(firestoreDb, "labeled_images");
      const querySnapshot = await getDocs(collectionRef);

      const labeledData = querySnapshot.docs.map((doc) => ({
        name: doc.id,
        ...doc.data(),
      }));

      // Sắp xếp theo timestamp mới nhất trước
      labeledData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // ✅ Lấy URL ảnh từ Firebase Storage
      const labeledImagesWithUrls = await Promise.all(
        labeledData.map(async (item) => {
          try {
            const imageRef = ref(imageDb, `labeled_images/${item.name}`);
            const url = await getDownloadURL(imageRef);
            return { ...item, url }; // Thêm URL vào dữ liệu
          } catch (error) {
            console.error(`Lỗi lấy URL ảnh ${item.name}:`, error);
            return null;
          }
        })
      );

      // Lọc bỏ ảnh không lấy được URL
      const filteredImages = labeledImagesWithUrls.filter(
        (img) => img !== null
      );

      // Cập nhật state
      setAllLabeledImages(filteredImages);
      setLatestLabeled(filteredImages.slice(0, 6)); // Lấy 6 ảnh gần nhất
    } catch (error) {
      console.error("Lỗi khi tải danh sách ảnh đã labeled:", error);
    }
  };

  const loadLabeledImages = async (imageList, page) => {
    const startIndex = page * 6;
    const endIndex = startIndex + 6;
    const selectedImages = imageList.slice(startIndex, endIndex);

    const recentImages = await Promise.all(
      selectedImages.map(async (img) => {
        const imageRef = ref(imageDb, `labeled_images/${img.name}`);
        try {
          const url = await getDownloadURL(imageRef);
          return { ...img, url };
        } catch (error) {
          console.error(`Lỗi khi lấy URL ảnh ${img.name}:`, error);
          return null;
        }
      })
    );

    setLatestLabeled(recentImages.filter(Boolean)); // Lọc bỏ ảnh lỗi
    setPageIndex(page);
  };

  const handleDeleteLabeledImage = async (imageName) => {
    try {
      const imageRef = ref(imageDb, `multipleFiles/${imageName}`);

      // Kiểm tra nếu URL hợp lệ (chỉ để debug, không thực sự cần thiết để xóa)
      await getDownloadURL(imageRef);

      // Xóa ảnh khỏi Firebase Storage
      await deleteObject(imageRef);

      // Cập nhật danh sách ảnh ngay lập tức
      setImageList((prevList) => {
        const updatedList = prevList.filter(
          (image) => image.name !== imageName
        );

        // Cập nhật chỉ số ảnh hiện tại nếu cần
        setCurrentIndex((prevIndex) =>
          Math.min(prevIndex, updatedList.length - 1)
        );

        return updatedList;
      });

      // Cập nhật tổng số ảnh
      setTotalImages((prevTotal) => Math.max(prevTotal - 1, 0));

      console.log(`Đã xóa ảnh: ${imageName}`);
    } catch (error) {
      console.error("Lỗi khi xóa ảnh:", error);
    }
  };

  const handlePrevPage = () => {
    if (pageIndex > 0) {
      loadLabeledImages(allLabeledImages, pageIndex - 1);
    }
  };

  const handleNextPage = () => {
    if ((pageIndex + 1) * 6 < allLabeledImages.length) {
      loadLabeledImages(allLabeledImages, pageIndex + 1);
    }
  };

  const handleSaveUpdatedLabel = async (index) => {
    try {
      const img = latestLabeled[index]; // Lấy ảnh cần cập nhật
      if (!img || !img.name) {
        console.error("Ảnh không hợp lệ để cập nhật.");
        return;
      }

      // Tham chiếu tới document của ảnh trong Firestore
      const docRef = doc(firestoreDb, "labeled_images", img.name);

      // Dữ liệu cập nhật
      const updatedLabelData = {
        label: img.label.trim(),
        labeledBy: "user@email.com",
        timestamp: new Date().toISOString(),
      };

      // Cập nhật nhãn mới cho ảnh
      await updateDoc(docRef, updatedLabelData);

      console.log(`Đã cập nhật nhãn cho ảnh: ${img.name}`);

      // Cập nhật lại danh sách ảnh đã labeled gần đây
      fetchAllLabeledImages();
    } catch (error) {
      console.error("Lỗi khi cập nhật nhãn:", error);
    }
  };

  return (
    <div className="label-container">
      <div className="label-section">
        <h1>Label Image</h1>
        {imageUrl && !showCrop ? (
          <>
            {imageUrl && (
              <div className="label-area">
                <img src={imageUrl} alt="Ảnh đang label" width="300" />
                <p>
                  <b>File:</b> {selectedImage?.name}
                </p>
                <div className="navigation-container">
                  <button
                    onClick={handlePrevImage}
                    disabled={currentIndex === 0}
                  >
                    {"<"} Ảnh trước
                  </button>
                  <span>
                    {currentIndex + 1} / {imageList.length}
                  </span>
                  <button
                    onClick={handleNextImage}
                    disabled={currentIndex === imageList.length - 1}
                  >
                    Ảnh sau {">"}
                  </button>
                </div>
                <p>
                  <b>Trạng thái:</b>{" "}
                  {imageInfo.label
                    ? `${imageInfo.label} - ${imageInfo.labeledBy}`
                    : "Chưa label"}
                </p>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Nhập nhãn..."
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveLabel()}
                />
                <button
                  onClick={async () => {
                    await handleDeleteLabeledImage(selectedImage.name);
                    handleNextImage();
                  }}
                >
                  Xóa ảnh
                </button>
              </div>
            )}
            <button type="success" onClick={() => setShowCrop(true)}>
              Crop Image
            </button>
          </>
        ) : (
          <CropComponent
            imageUrl={imageUrl}
            onUploadComplete={async (uploadedData) => {
              setShowCrop(false);
              setLabel(uploadedData.label);
              // Ensure uploadedData contains the name property
              if (uploadedData.name) {
                // Save the new label and coordinates to Firestore
                await setDoc(
                  doc(firestoreDb, "labeled_images", uploadedData.name),
                  {
                    label: uploadedData.label.trim(),
                    labeledBy: "user@email.com",
                    imagePath: `labeled_images/${uploadedData.name}`,
                    timestamp: new Date().toISOString(),
                    coordinates: uploadedData.coordinates, // Save coordinates
                  }
                );
                // Prepend the new labeled image to latestLabeled
                setLatestLabeled((prev) =>
                  [
                    { label: uploadedData.label, url: uploadedData.url },
                    ...prev,
                  ].slice(0, 6)
                );
                // Delete the original image
                if (selectedImage) {
                  const oldImageRef = ref(
                    imageDb,
                    `multipleFiles/${selectedImage.name}`
                  );
                  await deleteObject(oldImageRef);
                  setImageList((prev) =>
                    prev.filter((image) => image.name !== selectedImage.name)
                  );
                  // Automatically move to the next image
                  if (imageList.length > 1) {
                    loadImage(imageList[1], 0);
                  } else {
                    setImageUrl("");
                    setSelectedImage(null);
                  }
                }
                fetchAllLabeledImages();
                loadImageList(); // Reload the image list to reflect the deletion
              } else {
                console.error(
                  "Uploaded data does not contain a name property."
                );
              }
            }}
          />
        )}
      </div>
      <div className="recent-labels">
        <h2>Ảnh Labelled Gần đây</h2>

        <div className="recent-images">
          {latestLabeled.map((img, index) => (
            <div key={index} className="recent-item">
              <div className="image-container">
                <img
                  src={img.url}
                  alt={`Labeled ${index}`}
                  className="recent-image"
                />
              </div>
              <div className="label-container">
                <div className="input-wrapper">
                  <input
                    type="text"
                    value={img.label}
                    onChange={(e) => {
                      setLatestLabeled((prev) =>
                        prev.map((item, idx) =>
                          idx === index
                            ? { ...item, label: e.target.value }
                            : item
                        )
                      );
                    }}
                  />
                </div>
                <div className="button-group">
                  <button
                    className="save-button"
                    onClick={() => handleSaveUpdatedLabel(index)}
                  >
                    Lưu
                  </button>
                  <button
                    className="delete-button"
                    onClick={() => handleDeleteLabeledImage(img.name)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="pagination">
          <button onClick={handlePrevPage} disabled={pageIndex === 0}>
            {"<"} Trước
          </button>
          <span>Trang {pageIndex + 1}</span>
          <button
            onClick={handleNextPage}
            disabled={(pageIndex + 1) * 6 >= allLabeledImages.length}
          >
            Sau {">"}
          </button>
        </div>
      </div>
    </div>
  );
});

export default Label;
