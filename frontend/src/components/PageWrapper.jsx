import React from 'react';

export default function PageWrapper({ children, className = '' }) {
  return <div className={`page-wrapper ${className}`}>{children}</div>;
}