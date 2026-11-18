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
};

const AttendanceTrendChart: React.FC<AttendanceTrendProps> = ({
  data,
}) => {
  // Defensive guard: if data is empty, undefined, or not an array, show placeholder
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="chart-container p-6 text-center text-slate-500">
        <svg
          width={40}
          height={40}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="mx-auto mb-3"
        >
          <path d="M9 19v-4M15 19v-4M9 14v4M15 14v4M12 19L3 12h5l5 5L12 19z" />
        </svg>
        <p>No attendance data available</p>
      </div>
    );
  }

  const chartData: any = {
    labels: data.map((item) => item.date),
    datasets: [
      {
        label: "Attendance Rate",
        data: data.map((item) => item.attendanceRate),
        fill: true,
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2,
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
          callback: (value: any) =>
            `${Number(value) === Math.round(Number(value)) ? Number(value) : value}%`,
        },
        grid: {
          color: "rgba(148, 163, 182, 0.2)",
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
    <div className="chart-container p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
      <Line data={chartData} options={chartOptions} />
    </div>
  );
};

export default AttendanceTrendChart;