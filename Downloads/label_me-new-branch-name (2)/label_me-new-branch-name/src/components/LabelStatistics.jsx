import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { collection, getDocs, query, where } from "firebase/firestore";
import { firestoreDb } from "../firebase/firebaseConfig";
import "./LabelStatistics.css";

const LabelStatistics = ({ imageName }) => {
  const [labelStats, setLabelStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLabelStats = async () => {
      if (!imageName) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const labeledImagesRef = collection(firestoreDb, "labeled_images");
        // Get all documents first
        const querySnapshot = await getDocs(labeledImagesRef);

        // Tạo object để đếm số lượng mỗi nhãn
        const labelCounts = {};

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          // Check if this document is related to the current image
          if (data.imagePath && data.imagePath.includes(imageName)) {
            if (data.label) {
              labelCounts[data.label] = (labelCounts[data.label] || 0) + 1;
            }
          }
        });

        console.log("Label counts:", labelCounts); // Debug log

        // Chuyển đổi dữ liệu để hiển thị trên biểu đồ
        const chartData = Object.entries(labelCounts).map(([label, count]) => ({
          name: label,
          value: count,
        }));

        console.log("Chart data:", chartData); // Debug log

        setLabelStats(chartData);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching label statistics:", error);
        setLoading(false);
      }
    };

    fetchLabelStats();
  }, [imageName]);

  if (loading) {
    return <div className="loading">Loading statistics...</div>;
  }

  if (!imageName) {
    return null;
  }

  if (labelStats.length === 0) {
    return <div className="loading">No labels found for this image</div>;
  }

  return (
    <div className="statistics-container">
      <h3>Label Statistics for Current Image</h3>
      <div style={{ width: "100%", height: 200 }}>
        <ResponsiveContainer>
          <BarChart
            data={labelStats}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#4a90e2" name="Number of Labels" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="debug-info">
        <p>Current image: {imageName}</p>
        <p>Number of labels: {labelStats.length}</p>
      </div>
    </div>
  );
};

export default LabelStatistics;
