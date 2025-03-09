import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { imageDb, firestoreDb } from "../firebase/firebaseConfig";
import {
  listAll,
  ref,
  getDownloadURL,
  deleteObject,
  getMetadata,
  uploadBytes, // Add this line
} from "firebase/storage";
import {
  deleteField,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import CropComponent from "./CropComponent";
import { AiTwotoneDelete } from "react-icons/ai";
import "./Label.css";

const Label = forwardRef((props, sref) => {
  const [imageList, setImageList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageUrl, setImageUrl] = useState("");
  const [label, setLabel] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageInfo, setImageInfo] = useState({ label: "", labeledBy: "" });
  const [latestLabeled, setLatestLabeled] = useState([]);
  const inputRef = useRef(null);
  const [allLabeledImages, setAllLabeledImages] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [showCrop, setShowCrop] = useState(false);

  useImperativeHandle(sref, () => ({
    handleUpload: (fileUrls) => {
      setImageUrl(fileUrls);
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
      setImageUrl("");
      setSelectedImage(null);
    }
  }, [imageList]);

  useEffect(() => {
    const fetchImages = async () => {
      const storageRef = ref(imageDb, "images/");
      try {
        const result = await listAll(storageRef);
        const urls = await Promise.all(
          result.items.map((item) => getDownloadURL(item))
        );
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
      const filesWithMetadata = await Promise.all(
        result.items.map(async (item) => {
          const metadata = await getMetadata(item);
          return {
            ref: item,
            lastModified: metadata.updated,
          };
        })
      );

      filesWithMetadata.sort((a, b) => b.lastModified - a.lastModified);
      setImageList(filesWithMetadata.map((file) => file.ref));
      setTotalImages(filesWithMetadata.length);

      if (filesWithMetadata.length > 0) {
        loadImage(filesWithMetadata[0].ref, 0);
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
          labeledBy: "user@email.com",
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
      const newLabeledData = {
        name: img.name,
        url: oldImageUrl,
        label: newLabel,
      };
      setLatestLabeled((prev) => [newLabeledData, ...prev].slice(0, 6));
      setAllLabeledImages((prev) => [newLabeledData, ...prev]);

      await uploadBytes(newImageRef, blob);
      await setDoc(doc(firestoreDb, "labeled_images", img.name), {
        label: newLabel.trim(),
        labeledBy: "user@email.com",
        imagePath: newPath,
        timestamp: new Date().toISOString(),
      });

      await deleteObject(oldImageRef);
      setImageList((prev) => prev.filter((image) => image.name !== img.name));
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

      labeledData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const labeledImagesWithUrls = await Promise.all(
        labeledData.map(async (item) => {
          try {
            const imageRef = ref(imageDb, `labeled_images/${item.name}`);
            const url = await getDownloadURL(imageRef);
            return { ...item, url };
          } catch (error) {
            console.error(`Lỗi lấy URL ảnh ${item.name}:`, error);
            return null;
          }
        })
      );

      const filteredImages = labeledImagesWithUrls.filter(
        (img) => img !== null
      );

      setAllLabeledImages(filteredImages);
      setLatestLabeled(filteredImages.slice(0, 6));
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

    setLatestLabeled(recentImages.filter(Boolean));
    setPageIndex(page);
  };

  const handleDeleteLabeledImage = async (imageName) => {
    try {
      const imageRef = ref(imageDb, `multipleFiles/${imageName}`);
      await getDownloadURL(imageRef);
      await deleteObject(imageRef);

      setImageList((prevList) => {
        const updatedList = prevList.filter(
          (image) => image.name !== imageName
        );

        setCurrentIndex((prevIndex) =>
          Math.min(prevIndex, updatedList.length - 1)
        );

        return updatedList;
      });

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

  const handleStopLabeling = () => {
    const csvContent = [
      [
        "Image Path",
        "Label",
        "Labeled By",
        "Top Left (x,y)",
        "Bottom Right (x,y)",
      ],
      ...allLabeledImages.map((img) => [
        img.imagePath,
        img.label,
        img.labeledBy,
        img.coordinates
          ? `${img.coordinates.topLeft.x},${img.coordinates.topLeft.y}`
          : "",
        img.coordinates
          ? `${img.coordinates.bottomRight.x},${img.coordinates.bottomRight.y}`
          : "",
      ]),
      ...imageList.map((img) => [`multipleFiles/${img.name}`, "", "", "", ""]),
    ]
      .map((e) => e.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "labeled_images.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveUpdatedLabel = async (index) => {
    const updatedLabel = latestLabeled[index];
    try {
      await setDoc(doc(firestoreDb, "labeled_images", updatedLabel.name), {
        label: updatedLabel.label.trim(),
        labeledBy: "user@email.com",
        imagePath: `labeled_images/${updatedLabel.name}`,
        timestamp: new Date().toISOString(),
        coordinates: updatedLabel.coordinates ?? null,
      });
      console.log("Label updated successfully");
      // Update the state to reflect the changes
      setLatestLabeled((prev) =>
        prev.map((item, idx) =>
          idx === index ? { ...item, label: updatedLabel.label } : item
        )
      );
      // Update allLabeledImages to reflect the changes
      setAllLabeledImages((prev) =>
        prev.map((item) =>
          item.name === updatedLabel.name
            ? { ...item, label: updatedLabel.label }
            : item
        )
      );
    } catch (error) {
      console.error("Error updating label:", error);
    }
  };

  const handleDeleteRecentLabeledImage = async (imageName) => {
    try {
      await deleteDoc(doc(firestoreDb, "labeled_images", imageName));
      setLatestLabeled((prev) => prev.filter((img) => img.name !== imageName));
      console.log("Image deleted successfully");
    } catch (error) {
      console.error("Error deleting image:", error);
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
                    {"<"} Prev
                  </button>
                  <span>
                    {currentIndex + 1} / {imageList.length}
                  </span>
                  <button
                    onClick={handleNextImage}
                    disabled={currentIndex === imageList.length - 1}
                  >
                    Next {">"}
                  </button>
                </div>
                <p>
                  <b>Status:</b>{" "}
                  {imageInfo.label
                    ? `${imageInfo.label} - ${imageInfo.labeledBy}`
                    : "Unlabeled"}
                </p>
              </div>
            )}
            <div className="label-input-container">
              <input
                ref={inputRef}
                type="text"
                placeholder="Enter label..."
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
                Delete
              </button>
            </div>
            <button type="success" onClick={() => setShowCrop(true)}>
              Crop Image
            </button>
            <button onClick={handleStopLabeling} className="stop-button">
              Stop
            </button>
          </>
        ) : (
          <CropComponent
            imageUrl={imageUrl}
            selectedImage={selectedImage}
            imageList={imageList}
            setImageList={setImageList}
            setSelectedImage={setSelectedImage}
            setImageUrl={setImageUrl}
            onUploadComplete={async (uploadedDataArray) => {
              setShowCrop(false);
              for (const uploadedData of uploadedDataArray) {
                await setDoc(
                  doc(firestoreDb, "labeled_images", uploadedData.name),
                  {
                    label: uploadedData.label.trim(),
                    labeledBy: "user@email.com",
                    imagePath: `labeled_images/${uploadedData.name}`,
                    timestamp: new Date().toISOString(),
                    coordinates: uploadedData.coordinates,
                  }
                );
                setLatestLabeled((prev) =>
                  [
                    {
                      label: uploadedData.label,
                      url: uploadedData.url,
                      name: uploadedData.name,
                      coordinates: uploadedData.coordinates,
                    },
                    ...prev,
                  ].slice(0, 6)
                );
              }
            }}
            onExit={() => setShowCrop(false)}
          />
        )}
      </div>
      <div className="recent-labels">
        <h2>Recent Labeled</h2>
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
                      const newLabel = e.target.value;
                      setLatestLabeled((prev) =>
                        prev.map((item, idx) =>
                          idx === index ? { ...item, label: newLabel } : item
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
                    Save
                  </button>
                  <button
                    className="delete-button"
                    onClick={() => handleDeleteRecentLabeledImage(img.name)}
                  >
                    <AiTwotoneDelete size={20} color="white" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="pagination">
          <button onClick={handlePrevPage} disabled={pageIndex === 0}>
            {"<"} Prev
          </button>
          <span>Page {pageIndex + 1}</span>
          <button
            onClick={handleNextPage}
            disabled={(pageIndex + 1) * 6 >= allLabeledImages.length}
          >
            Next {">"}
          </button>
        </div>
      </div>
    </div>
  );
});

export default Label;
