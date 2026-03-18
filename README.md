# <img src="https://raw.githubusercontent.com/hkitago/CleanURL/refs/heads/main/Shared%20(Extension)/Resources/images/icon.svg" height="36" valign="bottom"/> CleanURL for Safari Extension

This Safari extension automatically removes tracking parameters and cleans URLs as you browse, producing shorter, shareable links while keeping the personal data that platforms embed quietly out of the picture. No editing, no holding down the delete key, no wondering which part of a long address is safe to share. True to the delete key its icon depicts, the list of parameters is fully customizable. Add what matters to you, remove what does not, and fewer trackers slip through by default. The extension adapts to how you actually browse, not the other way around.

Designed for anyone who shares links regularly and wants them to look exactly like what they are. Whether you are citing a source, sending a link to a friend, or dropping a URL into a newsletter, this extension handles the cleanup so you do not have to think about it. Privacy here is not a setting you configure once. It is something that happens in the background, every time.

## Installation & Uninstallation

### Installation

To install the extension on iOS or iPadOS, go to Settings > Apps > Safari > Extensions, or enable the extension by toggling it on in the Manage Extensions option found in the Safari address bar.
For macOS, open Safari, go to Safari > Settings > Extensions, and enable the extension from there.

### Uninstallation

To uninstall the extension, similarly to the installation process, toggle the extension off, or remove it completely by selecting the extension icon on the Home Screen and choosing "Delete app".

## Usage

1. Enable or Disable Cleaning

Click the extension icon in the browser toolbar to open the popover menu. Use the toggle switch to turn URL cleaning on or off. If a webpage doesn't look right, simply turn the toggle off to revert to the original URL.

- Off: <code><img src="https://raw.githubusercontent.com/hkitago/CleanURL/refs/heads/main/Shared%20(Extension)/Resources/images/toolbar-icon.svg" height="24" valign="bottom"/></code>
- On: <code><img src="https://raw.githubusercontent.com/hkitago/CleanURL/refs/heads/main/Shared%20(Extension)/Resources/images/toolbar-icon-on.svg" height="24" valign="bottom"/></code>

2. Add Custom Parameters

If you notice tracking parameters slipping through, you can block them on the spot via the popover. Before clicking Add Parameters, you can use the "Limit to current site" toggle:

- Off: The parameter will be cleaned on all websites you visit.
- On: The parameter will only be cleaned when you are on the current website.

> [!IMPORTANT]
> In shopping sites or modern web apps (SPAs), some parameters are essential for features like filtering, searching, or navigation. Avoid adding parameters that seem necessary for the site’s functionality.

3. Manage and Edit Parameters

To review or remove your settings, click Edit Parameters in the popover. This opens a dedicated page where you can manage your custom list:

- Use the toggles to include or exclude parameters from cleaning.
- Changes are saved automatically; you can close the page anytime.

> [!NOTE]
> Matching colors indicate parameters defined in both global and site-specific scopes, where your global settings will take priority.

## Latest Version

### [26.1] - 2026-03-01

- Added a dedicated management screen, allowing for easier customization of cleaning rules to reduce trackers slipping through

Previous Updates: [CHANGELOG.md](./CHANGELOG.md)

## Compatibility

- iOS/iPadOS 16.6+
- macOS 12.4+

## License

This project is open-source and available under the [MIT License](LICENSE). Feel free to use and modify it as needed.

## Acknowledgments

Inspired in part by [ClearURLs](https://github.com/ClearURLs/Rules), whose work helped inform the list of removable tracking parameters.

## Contact

You can reach me via [email](mailto:hkitago@icloud.com?subject=Support%20for%20CleanURL).

## Additional Information

### Related Links

- [Get extensions to customize Safari on iPhone - Apple Support](https://support.apple.com/guide/iphone/iphab0432bf6/18.0/ios/18.0)
- [Get extensions to customize Safari on Mac - Apple Support](https://support.apple.com/guide/safari/get-extensions-sfri32508/mac)
- [Use Safari extensions on your Mac – Apple Support](https://support.apple.com/102343)
- Privacy Policy Page: [Privacy Policy – hkitago software dev](https://hkitago.com/wpautoterms/privacy-policy/)
- Support Page: [hkitago/CleanURL](https://github.com/hkitago/CleanURL/)
