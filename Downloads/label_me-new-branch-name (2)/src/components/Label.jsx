const handleSaveLabel = async (img = selectedImage, newLabel = label) => {
  if (!img || !img.name || !newLabel.trim()) {
    console.log("No label or image selected.");
    alert("Vui lòng nhập nhãn!");
    return;
  }

  if (!selectedDataset) {
    alert("Vui lòng chọn dataset trước!");
    return;
  }

  try {
    const currentUserEmail = user?.email || "unknown";
    const timestamp = new Date().toISOString();

    // 1. Cập nhật UI ngay lập tức
    setLabel("");
    setImageInfo({
      label: newLabel.trim(),
      labeledBy: currentUserEmail,
      status: "labeled",
      coordinates: imageInfo.coordinates || null,
    });

    // 2. Cập nhật danh sách ảnh đã gán nhãn ngay lập tức
    const newLabeledData = {
      name: img.name,
      label: newLabel.trim(),
      labeledBy: currentUserEmail,
      timestamp: timestamp,
      coordinates: imageInfo.coordinates || null,
      dataset: selectedDataset,
    };

    setLatestLabeled((prev) => {
      const newList = [newLabeledData, ...prev].slice(0, 6);
      return newList;
    });

    // 3. Xóa khỏi danh sách chưa gán nhãn
    const updatedImageList = imageList.filter(
      (image) => image.name !== img.name
    );
    setImageList(updatedImageList);

    // 4. Chuyển sang ảnh tiếp theo ngay lập tức
    if (updatedImageList.length > 0) {
      const nextIndex = Math.min(currentIndex, updatedImageList.length - 1);
      loadImage(updatedImageList[nextIndex], nextIndex);
    } else {
      setImageUrl("");
      setSelectedImage(null);
      setMessage("Đã gán nhãn tất cả ảnh trong dataset!");
    }

    // 5. Thực hiện các thao tác lưu trữ trong background
    const sourceImageRef = ref(
      imageDb,
      `multipleFiles/${selectedDataset}/${img.name}`
    );
    const labeledImageRef = ref(
      imageDb,
      `labeled_images/${selectedDataset}/${img.name}`
    );

    // Tải và upload ảnh
    const imageBytes = await getBytes(sourceImageRef);
    const metadata = {
      contentType: "image/webp",
      customMetadata: {
        label: newLabel.trim(),
        labeledBy: currentUserEmail,
        timestamp: timestamp,
        dataset: selectedDataset,
        coordinates: imageInfo.coordinates
          ? JSON.stringify(imageInfo.coordinates)
          : "",
        status: "labeled",
      },
    };

    // Upload ảnh và xóa ảnh gốc
    await Promise.all([
      uploadBytes(labeledImageRef, imageBytes, metadata),
      deleteObject(sourceImageRef).catch((error) =>
        console.error("Error deleting source image:", error)
      ),
    ]);

    // Lấy URL và lưu vào Firestore
    const labeledUrl = await getDownloadURL(labeledImageRef);
    newLabeledData.url = labeledUrl;
    newLabeledData.imagePath = `labeled_images/${selectedDataset}/${img.name}`;

    await setDoc(doc(firestoreDb, "labeled_images", img.name), newLabeledData);

    // 6. Tải lại danh sách ảnh đã gán nhãn
    loadLabeledImages(0);

    setMessage(`Đã lưu nhãn cho ảnh ${img.name}!`);
    setTimeout(() => setMessage(""), 3000);
  } catch (error) {
    console.error("Error in handleSaveLabel:", error);
    setMessage(`Lỗi khi lưu nhãn: ${error.message}. Vui lòng thử lại!`);
    setTimeout(() => setMessage(""), 3000);
  }
};

const loadLabeledImages = async (page = 0) => {
  if (!selectedDataset) return;

  try {
    console.log("Loading labeled images for dataset:", selectedDataset);

    // Read CSV file from labeled_images directory
    const csvRef = ref(
      imageDb,
      `labeled_images/${selectedDataset}/${selectedDataset}.csv`
    );

    try {
      const url = await getDownloadURL(csvRef);
      const response = await fetch(url);
      const csvText = await response.text();

      // Skip header and get data lines
      const lines = csvText.split("\n");
      const headerLine = lines[0];
      if (!headerLine.includes("Image URL")) {
        console.error("Invalid CSV format");
        setLatestLabeled([]);
        setAllLabeledImages([]);
        return;
      }

      // Process each line in CSV
      const labeledData = [];
      for (const line of lines.slice(1)) {
        if (!line.trim()) continue;

        const [imageUrl, label, labeledBy, timestamp, coordinates] =
          line.split(",");
        if (!imageUrl || !label) continue;

        try {
          // Get image name from URL
          const imageName = decodeURIComponent(
            imageUrl.split("/").pop().split("?")[0]
          );

          // Create reference to image in labeled_images directory
          const imageRef = ref(
            imageDb,
            `labeled_images/${selectedDataset}/${imageName}`
          );

          try {
            // Get the latest URL for the image
            const currentUrl = await getDownloadURL(imageRef);

            labeledData.push({
              url: currentUrl,
              name: imageName,
              label: label,
              labeledBy: labeledBy,
              timestamp: timestamp,
              coordinates:
                coordinates && coordinates.trim() !== '""'
                  ? JSON.parse(coordinates.replace(/^"|"$/g, ""))
                  : null,
            });
          } catch (error) {
            console.log(
              `Image ${imageName} not found in labeled_images, trying original location...`
            );

            // Try to get image from original location as fallback
            const originalRef = ref(
              imageDb,
              `multipleFiles/${selectedDataset}/${imageName}`
            );

            try {
              const originalUrl = await getDownloadURL(originalRef);
              labeledData.push({
                url: originalUrl,
                name: imageName,
                label: label,
                labeledBy: labeledBy,
                timestamp: timestamp,
                coordinates:
                  coordinates && coordinates.trim() !== '""'
                    ? JSON.parse(coordinates.replace(/^"|"$/g, ""))
                    : null,
              });
            } catch (originalError) {
              console.log(
                `Image ${imageName} not found in any location, skipping...`
              );
            }
          }
        } catch (error) {
          console.error("Error processing line:", line, error);
          continue;
        }
      }

      // Get images for current page
      const startIndex = page * 6;
      const endIndex = startIndex + 6;
      const selectedImages = labeledData.slice(startIndex, endIndex);

      console.log("Loaded labeled images:", selectedImages);

      setLatestLabeled(selectedImages);
      setAllLabeledImages(labeledData);
      setPageIndex(page);
    } catch (error) {
      if (error.code === "storage/object-not-found") {
        console.log("No CSV file found for this dataset");
        // Create new CSV file with headers
        const headers = "Image URL,Label,Label By,Timestamp,Coordinates\n";
        const csvBlob = new Blob([headers], { type: "text/csv" });
        await uploadBytes(csvRef, csvBlob);

        setLatestLabeled([]);
        setAllLabeledImages([]);
        setPageIndex(0);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error("Error loading labeled images:", error);
    setLatestLabeled([]);
    setAllLabeledImages([]);
  }
};

const loadImageList = async () => {
  if (!selectedDataset) {
    console.log("No dataset selected");
    return;
  }

  try {
    const datasetRef = ref(imageDb, `multipleFiles/${selectedDataset}`);
    const result = await listAll(datasetRef);

    // Đọc file CSV từ thư mục labeled_images
    const csvRef = ref(
      imageDb,
      `labeled_images/${selectedDataset}/${selectedDataset}.csv`
    );
    let labeledImages = new Set();

    try {
      const url = await getDownloadURL(csvRef);
      const response = await fetch(url);
      const csvText = await response.text();

      if (!csvText.trim()) {
        console.log("Empty CSV file");
      } else {
        // Bỏ qua header và lấy thông tin ảnh đã gán nhãn
        const lines = csvText.split("\n").slice(1);
        lines.forEach((line) => {
          if (line.trim()) {
            const fileName = line.split(",")[0].split("/").pop().split("?")[0];
            labeledImages.add(decodeURIComponent(fileName));
          }
        });
        console.log("Found labeled images:", labeledImages.size);
      }
    } catch (error) {
      if (error.code === "storage/object-not-found") {
        console.log("Creating new CSV file with headers");
        // Tạo file CSV mới với header
        try {
          const headers = "Image URL,Label,Label By,Timestamp,Coordinates\n";
          const csvBlob = new Blob([headers], { type: "text/csv" });
          await uploadBytes(csvRef, csvBlob);
          console.log("Created new CSV file with headers");
        } catch (createError) {
          console.error("Error creating new CSV file:", createError);
        }
      } else {
        console.error("Error reading CSV:", error);
      }
    }

    // Lọc và sắp xếp ảnh chưa được labeled
    const unlabeledFiles = [];
    for (const item of result.items) {
      if (item.name.endsWith(".csv")) continue;

      if (!labeledImages.has(item.name)) {
        try {
          const metadata = await getMetadata(item);
          unlabeledFiles.push({
            ref: item,
            lastModified: metadata.updated,
          });
          console.log("Found unlabeled image:", item.name);
        } catch (error) {
          console.error(`Error getting metadata for ${item.name}:`, error);
        }
      } else {
        console.log(`Skipping labeled image: ${item.name}`);
      }
    }

    console.log(`Total unlabeled images: ${unlabeledFiles.length}`);

    // Sắp xếp theo thời gian mới nhất
    unlabeledFiles.sort((a, b) => b.lastModified - a.lastModified);

    const unlabeledRefs = unlabeledFiles.map((file) => file.ref);
    setImageList(unlabeledRefs);
    setTotalImages(unlabeledRefs.length);

    if (unlabeledRefs.length > 0) {
      await loadImage(unlabeledRefs[0], 0);
      setMessage(`Found ${unlabeledRefs.length} unlabeled images`);
    } else {
      setImageUrl("");
      setSelectedImage(null);
      setMessage("No unlabeled images found in this dataset");
    }
  } catch (error) {
    console.error("Error loading image list:", error);
    setMessage("Error loading images. Please try again.");
  }
};

const loadImagesFromCSV = async (datasetName) => {
  try {
    if (!datasetName) {
      setMessage("Please select a dataset first!");
      return;
    }

    setMessage("Loading images from dataset...");

    // Lấy danh sách ảnh từ thư mục dataset
    const datasetRef = ref(imageDb, `multipleFiles/${datasetName}`);
    const result = await listAll(datasetRef);

    // Đọc file CSV từ thư mục labeled_images
    const csvRef = ref(
      imageDb,
      `labeled_images/${datasetName}/${datasetName}.csv`
    );
    let labeledImages = new Set();

    try {
      const url = await getDownloadURL(csvRef);
      const response = await fetch(url);
      const csvText = await response.text();

      if (!csvText.trim()) {
        console.log("Empty CSV file");
      } else {
        // Bỏ qua header và lấy thông tin ảnh đã gán nhãn
        const lines = csvText.split("\n").slice(1);
        lines.forEach((line) => {
          if (line.trim()) {
            const fileName = line.split(",")[0].split("/").pop().split("?")[0];
            labeledImages.add(decodeURIComponent(fileName));
          }
        });
        console.log("Found labeled images:", labeledImages.size);
      }
    } catch (error) {
      if (error.code === "storage/object-not-found") {
        console.log("No CSV file found yet - creating new one");
        // Tạo file CSV mới với header
        try {
          const headers = "Image URL,Label,Label By,Timestamp,Coordinates\n";
          const csvBlob = new Blob([headers], { type: "text/csv" });
          await uploadBytes(csvRef, csvBlob);
          console.log("Created new CSV file with headers");
        } catch (createError) {
          console.error("Error creating new CSV file:", createError);
        }
      } else {
        console.error("Error reading CSV:", error);
      }
    }

    // Lọc ra các ảnh chưa được gán nhãn
    const unlabeledImages = [];
    for (const item of result.items) {
      if (item.name.endsWith(".csv")) continue;

      if (!labeledImages.has(item.name)) {
        try {
          const metadata = await getMetadata(item);
          unlabeledImages.push({
            ref: item,
            lastModified: metadata.updated,
            path: item.fullPath,
          });
          console.log("Found unlabeled image:", item.name);
        } catch (error) {
          console.error(`Error processing image ${item.name}:`, error);
        }
      } else {
        console.log(`Skipping labeled image: ${item.name}`);
      }
    }

    console.log(`Total unlabeled images: ${unlabeledImages.length}`);

    if (unlabeledImages.length === 0) {
      setMessage("No unlabeled images found in this dataset.");
      setImageUrl("");
      setSelectedImage(null);
      setImageList([]);
      setTotalImages(0);
      return;
    }

    // Sắp xếp theo thời gian mới nhất
    unlabeledImages.sort((a, b) => b.lastModified - a.lastModified);

    setImageList(unlabeledImages.map((img) => img.ref));
    setTotalImages(unlabeledImages.length);

    if (unlabeledImages.length > 0) {
      await loadImage(unlabeledImages[0].ref, 0);
      setMessage(`Found ${unlabeledImages.length} unlabeled images`);
    }

    // Load labeled images
    await loadLabeledImages(0);
  } catch (error) {
    console.error("Error loading images:", error);
    setMessage("Error loading images. Please try again.");
    setImageUrl("");
    setSelectedImage(null);
    setImageList([]);
    setTotalImages(0);
  }
};

const handleSaveUpdatedLabel = async (index) => {
  const updatedLabel = latestLabeled[index];
  try {
    // Check if image exists in labeled_images directory
    const labeledImageRef = ref(
      imageDb,
      `labeled_images/${selectedDataset}/${updatedLabel.name}`
    );
    try {
      await getDownloadURL(labeledImageRef);
    } catch (error) {
      // If image doesn't exist in labeled_images, copy from original directory
      const originalRef = ref(
        imageDb,
        `multipleFiles/${selectedDataset}/${updatedLabel.name}`
      );
      const originalUrl = await getDownloadURL(originalRef);
      const response = await fetch(originalUrl);
      const blob = await response.blob();
      await uploadBytes(labeledImageRef, blob);
    }

    // Get new URL of labeled image
    const labeledImageUrl = await getDownloadURL(labeledImageRef);

    // Update CSV in labeled_images directory
    const csvRef = ref(
      imageDb,
      `labeled_images/${selectedDataset}/${selectedDataset}.csv`
    );
    let csvContent = "";
    const headers = "Image URL,Label,Label By,Timestamp,Coordinates\n";

    try {
      const url = await getDownloadURL(csvRef);
      const response = await fetch(url);
      csvContent = await response.text();

      if (!csvContent.includes("Image URL")) {
        csvContent = headers;
      }

      // Split lines and update label for corresponding image
      const lines = csvContent.split("\n");
      let found = false;
      const updatedLines = lines.map((line) => {
        if (line.includes(updatedLabel.name)) {
          found = true;
          return `${labeledImageUrl},${updatedLabel.label.trim()},${
            updatedLabel.labeledBy
          },${updatedLabel.timestamp},${
            updatedLabel.coordinates
              ? JSON.stringify(updatedLabel.coordinates)
              : '""'
          }`;
        }
        return line;
      });

      // If image not found in CSV, add new line
      if (!found) {
        updatedLines.push(
          `${labeledImageUrl},${updatedLabel.label.trim()},${
            updatedLabel.labeledBy
          },${updatedLabel.timestamp},${
            updatedLabel.coordinates
              ? JSON.stringify(updatedLabel.coordinates)
              : '""'
          }`
        );
      }

      // Create new CSV content
      const updatedCsvContent = updatedLines.join("\n");
      const csvBlob = new Blob([updatedCsvContent], { type: "text/csv" });
      await uploadBytes(csvRef, csvBlob);

      // Update UI
      setLatestLabeled((prev) =>
        prev.map((item, idx) =>
          idx === index
            ? { ...item, url: labeledImageUrl, label: updatedLabel.label }
            : item
        )
      );

      setAllLabeledImages((prev) =>
        prev.map((item) =>
          item.name === updatedLabel.name
            ? { ...item, url: labeledImageUrl, label: updatedLabel.label }
            : item
        )
      );

      setMessage("Label updated successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      if (error.code === "storage/object-not-found") {
        // If CSV file doesn't exist, create new one
        const newCsvContent =
          headers +
          `${labeledImageUrl},${updatedLabel.label.trim()},${
            updatedLabel.labeledBy
          },${updatedLabel.timestamp},${
            updatedLabel.coordinates
              ? JSON.stringify(updatedLabel.coordinates)
              : '""'
          }`;
        const csvBlob = new Blob([newCsvContent], { type: "text/csv" });
        await uploadBytes(csvRef, csvBlob);
      } else {
        console.error("Error updating CSV:", error);
        throw error;
      }
    }
  } catch (error) {
    console.error("Error updating label:", error);
    setMessage("Error updating label. Please try again.");
  }
};

const handleDeleteRecentLabeledImage = async (imageName) => {
  if (!selectedDataset) {
    alert("Please select a dataset first!");
    return;
  }

  try {
    console.log("Deleting image:", imageName);

    // Update CSV file in labeled_images directory
    const csvRef = ref(
      imageDb,
      `labeled_images/${selectedDataset}/${selectedDataset}.csv`
    );
    let csvContent = "";
    const headers = "Image URL,Label,Label By,Timestamp,Coordinates\n";

    try {
      const url = await getDownloadURL(csvRef);
      const response = await fetch(url);
      csvContent = await response.text();

      if (!csvContent.includes("Image URL")) {
        csvContent = headers;
      }

      // Split lines and remove the image from CSV
      const lines = csvContent.split("\n");
      const updatedLines = lines.filter((line) => !line.includes(imageName));

      // Create new CSV content
      const updatedCsvContent = updatedLines.join("\n");
      const csvBlob = new Blob([updatedCsvContent], { type: "text/csv" });
      await uploadBytes(csvRef, csvBlob);

      // Update UI
      setLatestLabeled((prev) =>
        prev.filter((item) => item.name !== imageName)
      );
      setAllLabeledImages((prev) =>
        prev.filter((item) => item.name !== imageName)
      );

      setMessage("Label deleted successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      if (error.code === "storage/object-not-found") {
        // If CSV file doesn't exist, do nothing
        setMessage("Label not found in CSV.");
      } else {
        console.error("Error deleting label:", error);
        throw error;
      }
    }
  } catch (error) {
    console.error("Error deleting label:", error);
    setMessage("Error deleting label. Please try again.");
  }
};
