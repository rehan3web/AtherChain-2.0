import { Redirect } from 'expo-router';

export default function YouRedirect() {
  return <Redirect href={"/settings" as never} />;
}
