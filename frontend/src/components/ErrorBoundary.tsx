import { useState, useEffect } from "react";

interface ErrorBoundaryProps {
  fallback: React.ReactNode;
  fallThrough?: boolean;
}

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  { hasError: boolean; error?: Error; info?: React.ErrorInfo }
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: undefined, info: undefined };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log error to console (could send to error monitoring service)
    console.error("Error caught by ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export { ErrorBoundary };