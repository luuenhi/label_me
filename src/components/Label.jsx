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
  uploadBytes,
} from "firebase/storage";
import {
  doc,
  // getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import CropComponent from "./CropComponent";
// import { AiTwotoneDelete } from "react-icons/ai";
import { RiDeleteBinLine } from "react-icons/ri";
import "./Label.css";

import { getStorage } from "firebase/storage";

const storage = getStorage();
const storageRef = ref(storage, "path-to-your-file");

getDownloadURL(storageRef)
  .then((url) => {
    console.log("Download URL:", url);
  })
  .catch((error) => {
    console.error("Error fetching file:", error);
  });

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
  const [message, setMessage] = useState("");

  const { user } = props;

  useImperativeHandle(sref, () => ({
    handleUpload: (fileUrls) => {
      setImageUrl(fileUrls);
      loadImageList();
    },
  }));

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

  const loadImageList = async () => {
    try {
      const storageRef = ref(imageDb, "multipleFiles/");
      const result = await listAll(storageRef);
      console.log("Tải danh sách ảnh thành công:", result.items);
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
      console.log("Loading image:", imageRef.name);
      const url = await getDownloadURL(imageRef);
      setImageUrl(url);
      setCurrentIndex(index);
      setSelectedImage(imageRef);

      // Get the base filename after the last underscore
      const currentImageBaseName = imageRef.name.split("_").pop();

      // Kiểm tra label trong Firestore
      const querySnapshot = await getDocs(
        collection(firestoreDb, "labeled_images")
      );

      // Tìm document có label cho ảnh này
      const labelDoc = querySnapshot.docs.find((doc) => {
        const data = doc.data();
        // Extract the base filename from the stored imagePath
        const storedImageBaseName = data.imagePath.split("_").pop();

        return currentImageBaseName === storedImageBaseName;
      });

      if (labelDoc && labelDoc.data().label) {
        const labeledData = labelDoc.data();
        console.log("Found label:", labeledData);
        setImageInfo({
          label: labeledData.label,
          labeledBy: labeledData.labeledBy,
          status: "labeled",
        });
        setLabel(labeledData.label);
      } else {
        console.log("No label found");
        setImageInfo({
          label: "",
          labeledBy: "",
          status: "unlabeled",
        });
        setLabel("");
      }

      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (error) {
      console.error("Error loading image:", error);
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
    if (!img || !img.name || !newLabel.trim()) {
      console.log("Không có nhãn hoặc ảnh chưa được chọn.");
      alert("Vui lòng nhập nhãn!");
      return;
    }

    try {
      console.log("Saving label for:", img.name);

      // Các bước lưu nhãn vào Firestore và Storage...
      const originalImageRef = ref(imageDb, `multipleFiles/${img.name}`);
      const newImageRef = ref(imageDb, `labeled_images/${img.name}`);

      console.log("Uploading label...");

      setImageList((prev) => prev.filter((image) => image.name !== img.name));
      setLabel("");
      setTimeout(handleNextImage, 0);

      const [url, querySnapshot] = await Promise.all([
        getDownloadURL(originalImageRef),
        getDocs(collection(firestoreDb, "labeled_images")),
      ]);

      const response = await fetch(url);
      const blob = await response.blob();

      await Promise.all([
        uploadBytes(newImageRef, blob),
        deleteObject(originalImageRef),
        (() => {
          const labelData = {
            label: newLabel.trim(),
            labeledBy: user.email,
            imagePath: `labeled_images/${img.name}`,
            originalPath: `multipleFiles/${img.name}`,
            status: "labeled",
            timestamp: new Date().toISOString(),
          };

          const existingDoc = querySnapshot.docs.find(
            (doc) => doc.data().imagePath === `multipleFiles/${img.name}`
          );

          return existingDoc
            ? updateDoc(existingDoc.ref, labelData)
            : setDoc(doc(collection(firestoreDb, "labeled_images")), labelData);
        })(),
      ]);

      const newImageUrl = await getDownloadURL(newImageRef);
      const newLabeledData = {
        name: img.name,
        url: newImageUrl,
        label: newLabel.trim(),
        labeledBy: user.email,
        imagePath: `labeled_images/${img.name}`,
        originalPath: `multipleFiles/${img.name}`,
        status: "labeled",
        timestamp: new Date().toISOString(),
      };

      setLatestLabeled((prev) => [newLabeledData, ...prev].slice(0, 6));
      setAllLabeledImages((prev) => [newLabeledData, ...prev]);

      console.log("Label saved successfully!");
    } catch (error) {
      console.error("Error saving label:", error);
    }
  };

  const fetchAllLabeledImages = async () => {
    try {
      console.log("Fetching all labeled images");
      const querySnapshot = await getDocs(
        collection(firestoreDb, "labeled_images")
      );

      const labeledData = await Promise.all(
        querySnapshot.docs.map(async (doc) => {
          const data = doc.data();
          try {
            const imageRef = ref(
              imageDb,
              `labeled_images/${data.imagePath.split("/").pop()}`
            );
            const url = await getDownloadURL(imageRef);
            return {
              name: data.imagePath.split("/").pop(), // Lấy tên file từ path
              url,
              ...data,
            };
          } catch (error) {
            console.error(`Error getting URL for ${doc.id}:`, error);
            return null;
          }
        })
      );

      const filteredImages = labeledData.filter((img) => img !== null);
      filteredImages.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );

      setAllLabeledImages(filteredImages);
      setLatestLabeled(filteredImages.slice(0, 6));
    } catch (error) {
      console.error("Error fetching labeled images:", error);
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
      // Delete from Storage
      try {
        await deleteObject(imageRef);
        console.log("Đã xóa ảnh từ multipleFiles:", imageName);
      } catch (error) {
        console.log("Ảnh không tồn tại trong Storage hoặc đã bị xóa");
      }

      // Delete from Firestore collection
      const querySnapshot = await getDocs(
        collection(firestoreDb, "labeled_images")
      );
      const docToDelete = querySnapshot.docs.find((doc) => {
        const data = doc.data();
        return data.imagePath.split("_").pop() === imageName.split("_").pop();
      });

      if (docToDelete) {
        await deleteDoc(docToDelete.ref);
        console.log("Đã xóa document từ Firestore");
      }

      setImageList((prevList) =>
        prevList.filter((image) => image.name !== imageName)
      );

      if (imageList.length <= 1) {
        setSelectedImage(null);
        setMessage("No more images to label.");
      } else {
        handleNextImage();
      }

      setImageInfo({
        label: "",
        labeledBy: "",
        status: "unlabeled",
      });
      setLabel("");
      setTotalImages((prev) => Math.max(prev - 1, 0));

      console.log(`Đã xóa ảnh: ${imageName}`);
    } catch (error) {
      console.error("Lỗi khi xóa ảnh:", error);
      throw error;
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

  const handleStopLabeling = async () => {
    if (allLabeledImages.length === 0) {
      alert("Không có ảnh nào để lưu.");
      return;
    }

    const labeledImagesWithUrls = await Promise.all(
      allLabeledImages.map(async (img) => {
        const imageRef = ref(imageDb, img.imagePath);
        try {
          const url = await getDownloadURL(imageRef);
          return { ...img, url };
        } catch (error) {
          console.error(`Lỗi khi lấy URL ảnh ${img.name}:`, error);
          return null;
        }
      })
    );

    const validLabeledImages = labeledImagesWithUrls.filter(
      (img) => img !== null
    );

    const csvContent = [
      [
        "Image Path",
        "Label",
        "Labeled By",
        "Top Left (x,y)",
        "Bottom Right (x,y)",
      ],
      ...validLabeledImages.map((img) => [
        img.url,
        img.label,
        img.labeledBy,
        img.coordinates
          ? `${img.coordinates.topLeft.x},${img.coordinates.topLeft.y}`
          : "",
        img.coordinates
          ? `${img.coordinates.bottomRight.x},${img.coordinates.bottomRight.y}`
          : "",
      ]),
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
        status: "labeled",
        timestamp: new Date().toISOString(),
        coordinates: updatedLabel.coordinates ?? null,
      });
      console.log("Label updated successfully");

      setLatestLabeled((prev) =>
        prev.map((item, idx) =>
          idx === index
            ? { ...item, label: updatedLabel.label, status: "labeled" }
            : item
        )
      );

      setAllLabeledImages((prev) =>
        prev.map((item) =>
          item.name === updatedLabel.name
            ? { ...item, label: updatedLabel.label, status: "labeled" }
            : item
        )
      );
    } catch (error) {
      console.error("Error updating label:", error);
    }
  };

  const handleDeleteRecentLabeledImage = async (imageName) => {
    try {
      const imageRef = ref(imageDb, `labeled_images/${imageName}`);
      try {
        await deleteObject(imageRef);
        console.log("Đã xóa ảnh từ Storage:", imageName);
      } catch (error) {
        console.error("Lỗi khi xóa ảnh từ Storage:", error);
      }
      await deleteDoc(doc(firestoreDb, "labeled_images", imageName));
      console.log("Đã xóa thông tin từ Firestore");
      setLatestLabeled((prev) => prev.filter((img) => img.name !== imageName));
      setAllLabeledImages((prev) =>
        prev.filter((img) => img.name !== imageName)
      );

      console.log("Đã xóa ảnh thành công");
    } catch (error) {
      console.error("Lỗi khi xóa ảnh:", error);
    }
  };

  return (
    <div className="label-container">
      <div className="main-content">
        {!selectedImage && message ? (
          <div className="message-container">
            <p className="message">{message}</p>
          </div>
        ) : (
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
                        ? `${imageInfo.label} - by ${imageInfo.labeledBy}`
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
                    className="delete-labeled-button"
                    onClick={async () => {
                      try {
                        await handleDeleteLabeledImage(selectedImage.name);
                        if (imageList.length <= 1) {
                          setSelectedImage(null);
                          setMessage("No more images to label.");
                        } else {
                          handleNextImage();
                        }
                      } catch (error) {
                        console.error("Error deleting image:", error);
                        setMessage("Error deleting image. Please try again.");
                      }
                    }}
                  >
                    <RiDeleteBinLine size={18} />
                    <span>Delete</span>
                  </button>
                </div>
                <button type="success" onClick={() => setShowCrop(true)}>
                  Crop Image
                </button>
                <button onClick={handleStopLabeling} className="stop-button">
                  Stop
                </button>
              </>
            ) : showCrop ? (
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
                  if (selectedImage) {
                    try {
                      const originalImageRef = ref(
                        imageDb,
                        `multipleFiles/${selectedImage.name}`
                      );
                      await deleteObject(originalImageRef);
                      console.log(
                        "Original image deleted:",
                        selectedImage.name
                      );

                      setImageList((prev) =>
                        prev.filter(
                          (image) => image.name !== selectedImage.name
                        )
                      );
                      if (imageList.length > 1) {
                        setSelectedImage(imageList[1]);
                      } else {
                        setImageUrl("");
                        setSelectedImage(null);
                      }
                    } catch (error) {
                      console.error("Error deleting original image:", error);
                    }
                  }
                }}
                onExit={() => setShowCrop(false)}
              />
            ) : null}
          </div>
        )}
      </div>

      {/* Recent Labeled*/}
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
                    style={{
                      width: "100%",
                      padding: "8px",
                      boxSizing: "border-box",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      marginRight: "8px",
                    }}
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
                <div className="button-container">
                  <button
                    className="save-button"
                    onClick={() => handleSaveUpdatedLabel(index)}
                  >
                    Save
                  </button>
                  <button
                    className="delete-icon-button"
                    onClick={() => handleDeleteRecentLabeledImage(img.name)}
                  >
                    <RiDeleteBinLine size={15} />
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
