class ErrorBoundary extends window.React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }
  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return {
      hasError: true
    };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "40px",
          color: "var(--text-primary)",
          fontFamily: "Inter, sans-serif"
        }
      }, /*#__PURE__*/React.createElement("h2", {
        style: {
          color: "#EF4444"
        }
      }, "Something went wrong."), /*#__PURE__*/React.createElement("details", {
        style: {
          whiteSpace: "pre-wrap",
          background: "var(--bg-input)",
          padding: "16px",
          borderRadius: "8px",
          marginTop: "16px"
        }
      }, this.state.error && this.state.error.toString(), /*#__PURE__*/React.createElement("br", null), this.state.errorInfo && this.state.errorInfo.componentStack), /*#__PURE__*/React.createElement("button", {
        onClick: () => window.location.reload(),
        style: {
          marginTop: "24px",
          padding: "10px 16px",
          background: "#10B981",
          color: "#0B0F19",
          border: "none",
          borderRadius: "8px",
          fontWeight: "bold",
          cursor: "pointer"
        }
      }, "Reload Page"));
    }
    return this.props.children;
  }
}
window.ErrorBoundary = ErrorBoundary;