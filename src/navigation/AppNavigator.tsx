import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
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
import { theme } from '../theme';

const Stack = createStackNavigator<RootStackParamList>();

const navTheme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        background: theme.colors.background,
    },
};

export const AppNavigator: React.FC = () => {
    return (
        <NavigationContainer theme={navTheme}>
            <Stack.Navigator
                initialRouteName="Splash"
                screenOptions={{
                    headerShown: false,
                    cardStyle: { backgroundColor: theme.colors.background },
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
