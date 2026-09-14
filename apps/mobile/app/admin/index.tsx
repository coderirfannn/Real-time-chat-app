import React from 'react';
import { Redirect } from 'expo-router';

export default function AdminIndex(): React.JSX.Element {
  return <Redirect href="/admin/dashboard" />;
}
