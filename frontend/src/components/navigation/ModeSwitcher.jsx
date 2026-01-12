import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../styles/theme';

export default function ModeSwitcher({ currentMode, onSwitch, theme }) {
    const modes = ['Personal', 'Work', 'Social'];

    return (
        <View style={[styles.container, { backgroundColor: theme.surface }]}>
            <View style={[styles.switchContainer, { backgroundColor: theme.inputBg }]}>
                {modes.map((mode) => {
                    const isActive = currentMode === mode.toLowerCase();
                    const modeKey = mode.toLowerCase();
                    return (
                        <TouchableOpacity
                            key={mode}
                            onPress={() => onSwitch(modeKey)}
                            style={[
                                styles.modeBtn,
                                isActive && { backgroundColor: theme.surface, elevation: 2, shadowColor: theme.shadow, shadowOpacity: 0.1, shadowRadius: 2 }
                            ]}
                        >
                            <Text style={[
                                styles.modeText,
                                { color: isActive ? theme.textPrimary : theme.textSecondary },
                                isActive && { fontWeight: 'bold' }
                            ]}>
                                {mode}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        // borderBottomWidth: 1,
        // borderColor: 'rgba(0,0,0,0.05)'
    },
    switchContainer: {
        flexDirection: 'row',
        borderRadius: 25,
        padding: 4,
        justifyContent: 'space-between'
    },
    modeBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 20,
    },
    modeText: {
        fontSize: 14,
        fontWeight: '500'
    }
});
