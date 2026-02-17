const handleCreateReel = async () => {
    console.log("Create Reel Pressed");

    // Request Permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Need media permissions!');
        return;
    }

    try {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            // 1. Upload Video
            const formData = new FormData();
            formData.append('file', {
                uri: asset.uri,
                type: 'video/mp4',
                name: 'reel.mp4'
            });

            const uploadRes = await fetch(`${SERVER_URL}/api/auth/upload`, {
                method: 'POST',
                body: formData
            });

            if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                const userId = await AsyncStorage.getItem('userId');

                // 2. Create Reel Entry
                // We can show a prompt for caption here, but for now we'll create with default/empty caption
                // Or we could navigate to a "EditReel" screen. For simplicity in this task, we'll confirm with user or just create.

                Alert.prompt(
                    "New Reel",
                    "Enter a caption for your reel:",
                    [
                        { text: "Cancel", style: "cancel" },
                        {
                            text: "Post",
                            onPress: async (caption) => {
                                const res = await fetch(`${SERVER_URL}/api/auth/reels/create`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        userId,
                                        url: uploadData.url,
                                        caption: caption || ""
                                    })
                                });

                                if (res.ok) {
                                    Alert.alert("Success", "Reel Posted!");
                                    // Ideally trigger a refresh of reels
                                } else {
                                    Alert.alert("Error", "Failed to post reel");
                                }
                            }
                        }
                    ],
                    "plain-text"
                );

            } else {
                Alert.alert("Error", "Video upload failed");
            }
        }
    } catch (e) {
        console.error(e);
        Alert.alert("Error", e.message);
    }
};
