import os

frontend_dir = r"c:\Users\shambu\OneDrive\Desktop\INtRAA\frontend"

replacements = {
    "http://192.168.29.129:5000": "https://gurudipaksalviprivatelimited.com",
    "http://192.168.29.129:5000/api/auth": "https://gurudipaksalviprivatelimited.com/api/auth",
    "scrollToEnd({ animated: true })": "scrollToEnd({ animated: false })",
    "scrollToEnd({animated: true})": "scrollToEnd({animated: false})"
}

for root, dirs, files in os.walk(frontend_dir):
    if "node_modules" in dirs:
        dirs.remove("node_modules")
    if ".expo" in dirs:
        dirs.remove(".expo")

    for file in files:
        if file.endswith(".js") or file.endswith(".jsx"):
            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                new_content = content
                for old_str, new_str in replacements.items():
                    new_content = new_content.replace(old_str, new_str)

                if new_content != content:
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(new_content)
                    print(f"Updated: {file_path}")
            except Exception as e:
                print(f"Failed to read/write {file_path}: {e}")

print("Fix applied.")
