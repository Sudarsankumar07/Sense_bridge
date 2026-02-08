import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import WelcomeScreen from './screens/WelcomeScreen';
import BlindModeScreen from './screens/BlindModeScreen';
import SignModeScreen from './screens/SignModeScreen';
import DeafModeScreen from './screens/DeafModeScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          headerShown: false,
          gestureEnabled: false,
          animationEnabled: true,
          cardStyleInterpolator: ({ current: { progress } }) => ({
            cardStyle: {
              opacity: progress,
            },
          }),
        }}
      >
        <Stack.Screen
          name="Welcome"
          component={WelcomeScreen}
          options={{ title: 'SenseBridge' }}
        />
        <Stack.Screen
          name="BlindMode"
          component={BlindModeScreen}
          options={{ title: 'Blind Mode' }}
        />
        <Stack.Screen
          name="SignMode"
          component={SignModeScreen}
          options={{ title: 'Sign Mode' }}
        />
        <Stack.Screen
          name="DeafMode"
          component={DeafModeScreen}
          options={{ title: 'Deaf Mode' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
