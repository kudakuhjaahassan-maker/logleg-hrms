import React from "react";
import { Line } from "react-chartjs-2";

type AttendanceTrendProps = {
  data: { date: string; attendanceRate: number }[];
};

const AttendanceTrendChart: React.FC<AttendanceTrendProps> = ({ data }) => {
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
          callback: (value: any) => `${Number(value) === Math.round(Number(value)) ? Number(value) : value}%`,
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
    <div className="chart-container">
      <Line data={chartData} options={chartOptions} />
    </div>
  );
};

export default AttendanceTrendChart;