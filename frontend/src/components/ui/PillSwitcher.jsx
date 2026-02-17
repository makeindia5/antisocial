import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function PillSwitcher({ items, activeItem, onSelect, variant = 'default' }) {
    const { colors } = useTheme();

    return (
        <View style={styles.container}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {items.map((item) => {
                    const isActive = activeItem === item.value;

                    // Style Logic
                    let backgroundColor, textColor;
                    if (variant === 'glass') {
                        // White background for both, text color indicates selection
                        backgroundColor = '#FFFFFF';
                        textColor = isActive ? '#008080' : '#666666'; // Teal for active, Grey for inactive
                    } else {
                        // Default
                        backgroundColor = isActive ? colors.primary : colors.inputBg;
                        textColor = isActive ? '#FFFFFF' : colors.textSecondary;
                    }

                    return (
                        <TouchableOpacity
                            key={item.value}
                            onPress={() => onSelect(item.value)}
                            style={[
                                styles.pill,
                                { backgroundColor }
                            ]}
                        >
                            <Text style={[
                                styles.text,
                                { color: textColor }
                            ]}>
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 10,
    },
    scrollContent: {
        paddingHorizontal: 20,
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pill: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 30,
        marginRight: 10,
    },
    text: {
        fontWeight: '600',
        fontSize: 15,
    },
});
