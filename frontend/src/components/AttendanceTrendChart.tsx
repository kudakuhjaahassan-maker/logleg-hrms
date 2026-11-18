import React from "react";
import { Line } from "react-chartjs-2";

// Explicitly register all required Chart.js components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type AttendanceTrendProps = {
  data: { date: string; attendanceRate: number }[];
  primaryColor?: string;
};

const AttendanceTrendChart: React.FC<AttendanceTrendProps> = ({
  data,
  primaryColor = "#2563eb",
}) => {
  // Defensive guard: if data is empty, undefined, or not an array, show placeholder
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="chart-container p-4 text-center text-slate-500 backdrop-blur-xl border border-slate-200/60 rounded-2xl">
        <svg
          width={32}
          height={32}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="mx-auto mb-2"
        >
          <path d="M9 19v-4M15 19v-4M9 14v4M15 14v4M12 19L3 12h5l5 5L12 19z" />
        </svg>
        <p style={{ fontSize: "12px" }}>No attendance data available</p>
      </div>
    );
  }

  // Determine glass theme based on primary color lightness
  const isDarkTheme = primaryColor.startsWith("#1") || primaryColor.startsWith("#2");
  const cardBg = isDarkTheme
    ? "rgba(15, 23, 42, 0.80)"
    : "rgba(255, 255, 255, 0.80)";
  const borderColor = isDarkTheme
    ? "rgba(148, 163, 182, 0.40)"
    : "rgba(148, 163, 182, 0.60)";
  const textColor = isDarkTheme ? "#f8fafc" : "#0f172a";

  const chartData: any = {
    labels: data.map((item) => item.date),
    datasets: [
      {
        label: "Attendance Rate",
        data: data.map((item) => item.attendanceRate),
        fill: true,
        borderColor: primaryColor,
        backgroundColor: `${primaryColor.substr(
          0,
          7
        )}20`,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
        pointBackgroundColor: primaryColor,
        pointBorderColor: "#fff",
      },
    ],
  };

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
        // Custom tooltip styling with glass effect
        mode: "index",
        intersect: false,
        padding: 6,
        backgroundColor: "rgba(15, 23, 42, 0.7)",
        titleColor: "#fff",
        bodyColor: "#fff",
        borderColor: "rgba(148, 163, 182, 0.5)",
        borderWidth: 1,
      },
    },
    scales: {
      y: {
        display: true,
        title: {
          display: true,
          text: "Attendance Rate (%)",
        },
        ticks: {
          stepSize: 5,
          max: 100,
          min: 0,
          color: isDarkTheme ? "#fff" : "#0f172a",
          callback: (value: any) =>
            `${Number(value) === Math.round(Number(value)) ? Number(value) : value}%`,
        },
        grid: {
          color: isDarkTheme
            ? "rgba(148, 163, 182, 0.20)"
            : "rgba(148, 163, 182, 0.30)",
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div
      className={`chart-container p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 transition-colors duration-200 w-full max-w-xs`}
      data-primary-color={primaryColor}
    >
      <Line
        data={chartData}
        options={chartOptions}
      />
    </div>
  );
};

export default AttendanceTrendChart;