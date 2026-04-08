import { Redirect } from 'expo-router'

/** Stack route kept for deep links / old URLs — account UI lives under Account tab. */
export default function ProfileRedirect() {
  return <Redirect href="/(tabs)/settings" />
}
