export default function CropComponent({
  imageUrl,
  selectedImage,
  imageList,
  setImageList,
  setSelectedImage,
  setImageUrl,
  onUploadComplete,
  onExit,
  selectedDataset,
  user,
}) {
  const cropperRef = useRef(null);
  const [croppedImages, setCroppedImages] = useState([]);
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const dataURLtoFile = (dataurl, filename) => {
    try {
      const arr = dataurl.split(",");
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    } catch (error) {
      console.error("Error converting dataURL to File:", error);
      return null;
    }
  };

  const onCrop = () => {
    if (!fileName) {
      alert("Vui lòng nhập nhãn trước khi crop ảnh.");
      return;
    }
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      try {
        const croppedDataUrl = cropper
          .getCroppedCanvas()
          .toDataURL("image/jpeg", 0.9);
        const coordinates = cropper.getData();
        setCroppedImages((prev) => [
          ...prev,
          {
            dataUrl: croppedDataUrl,
            fileName,
            coordinates: {
              x: Math.round(coordinates.x),
              y: Math.round(coordinates.y),
              width: Math.round(coordinates.width),
              height: Math.round(coordinates.height),
            },
          },
        ]);
        setFileName("");
      } catch (error) {
        console.error("Error during cropping:", error);
        alert("Có lỗi xảy ra khi crop ảnh. Vui lòng thử lại.");
      }
    }
  };

  const handleUploadAll = async () => {
    if (croppedImages.length === 0) {
      alert("Không có ảnh nào để upload.");
      return;
    }

    setIsUploading(true);
    const uploadedDataArray = [];

    try {
      for (const { dataUrl, fileName, coordinates } of croppedImages) {
        const file = dataURLtoFile(dataUrl, `${fileName}.jpg`);
        if (!file) {
          throw new Error("Không thể tạo file từ ảnh đã crop");
        }

        const uniqueFileName = `${uuidv4()}_${file.name}`;
        const imagePath = `labeled_images/${selectedDataset}/${uniqueFileName}`;
        const imageRef = ref(imageDb, imagePath);

        const metadata = {
          contentType: "image/jpeg",
          customMetadata: {
            label: fileName,
            coordinates: JSON.stringify(coordinates),
            status: "labeled",
            dataset: selectedDataset,
            timestamp: new Date().toISOString(),
            labeledBy: user?.email || "unknown",
          },
        };

        await uploadBytes(imageRef, file, metadata);
        const url = await getDownloadURL(imageRef);

        await setDoc(doc(firestoreDb, "labeled_images", uniqueFileName), {
          name: uniqueFileName,
          url: url,
          label: fileName,
          coordinates: coordinates,
          dataset: selectedDataset,
          status: "labeled",
          timestamp: metadata.customMetadata.timestamp,
          labeledBy: metadata.customMetadata.labeledBy,
          imagePath: imagePath,
        });

        uploadedDataArray.push({
          name: uniqueFileName,
          url: url,
          label: fileName,
          coordinates: coordinates,
          dataset: selectedDataset,
          status: "labeled",
          timestamp: metadata.customMetadata.timestamp,
          labeledBy: metadata.customMetadata.labeledBy,
        });
      }

      if (selectedImage) {
        try {
          const originalImageRef = ref(
            imageDb,
            `multipleFiles/${selectedDataset}/${selectedImage.name}`
          );
          await deleteObject(originalImageRef);
          console.log("Original image deleted:", selectedImage.name);
        } catch (error) {
          console.error("Error deleting original image:", error);
        }
      }

      setCroppedImages([]);
      if (onUploadComplete) {
        onUploadComplete(uploadedDataArray);
      }
    } catch (error) {
      console.error("Error during upload:", error);
      alert("Có lỗi xảy ra khi upload ảnh. Vui lòng thử lại.");
    } finally {
      setIsUploading(false);
    }
  };

  // ... rest of the component code
}
