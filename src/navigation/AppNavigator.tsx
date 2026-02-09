import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import {
    SplashScreen,
    ModeSelectionScreen,
    BlindModeScreen,
    SignModeScreen,
    DeafModeScreen,
    SettingsScreen,
} from '../screens';

const Stack = createStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
    return (
        <NavigationContainer>
            <Stack.Navigator
                initialRouteName="Splash"
                screenOptions={{
                    headerShown: false,
                    cardStyle: { backgroundColor: '#0a0a0a' },
                    animationEnabled: true,
                }}
            >
                <Stack.Screen name="Splash" component={SplashScreen} />
                <Stack.Screen name="ModeSelection" component={ModeSelectionScreen} />
                <Stack.Screen name="BlindMode" component={BlindModeScreen} />
                <Stack.Screen name="SignMode" component={SignModeScreen} />
                <Stack.Screen name="DeafMode" component={DeafModeScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};
