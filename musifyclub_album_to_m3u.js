(function() {
    // Selector for the action links (those containing the track's URL)
    const actionLinkSelector = 'div.playlist div.playlist__item div.playlist__actions a';

    // Selector to find artist and track links *within* a playlist__item element.
    const headingLinksRelativeSelector = 'div.playlist__details div.playlist__heading a';

    // CORRECT Selector to find the element containing the duration *within* a playlist__item element.
    // We look for the span.text-muted that is inside a div.track__details that does *not* have the .track__rating class
    const durationElementRelativeSelector = 'div.track__details:not(.track__rating) span.text-muted';

    // Selector for the album header
    const albumHeaderSelector = 'header.content__title h1';


    const actionAnchorElements = document.querySelectorAll(actionLinkSelector);
    const m3uEntries = []; // Array to store formatted #EXTINF + URL strings

    console.log('--- Starting M3U Link Extraction (with Duration and Artist - Track) ---');

    if (actionAnchorElements.length > 0) {
        actionAnchorElements.forEach(function(actionAnchor, index) { // Added index for warning messages
            if (actionAnchor.href) {
                const url = actionAnchor.href; // The URL is in the action link

                let title = 'Unknown Artist - Unknown Track'; // Default fallback title
                let duration = -1; // Default fallback duration (unknown)

                // Climb the DOM tree from the action link to find the parent element
                // that represents the single complete playlist item (.playlist__item)
                const playlistItem = actionAnchor.closest('.playlist__item');

                if (playlistItem) {
                    // --- Duration Extraction ---
                    // Use the CORRECT selector to find the duration element (e.g., 01:19)
                    const durationElement = playlistItem.querySelector(durationElementRelativeSelector);

                    if (durationElement) {
                        const durationText = durationElement.textContent.trim();
                        const timeParts = durationText.split(':'); // Splits the string by the ':' character

                        if (timeParts.length === 2) {
                            // If we get 2 parts (minutes and seconds)
                            const minutes = parseInt(timeParts[0], 10); // Convert the minutes part to an integer (base 10)
                            const seconds = parseInt(timeParts[1], 10); // Convert the seconds part to an integer (base 10)

                            // Check that the conversion was successful (not NaN)
                            if (!isNaN(minutes) && !isNaN(seconds)) {
                                duration = (minutes * 60) + seconds; // Calculate the total duration in seconds
                                if (duration < 0) duration = -1; // Ensures the duration is not negative for some strange case
                            } else {
                                console.warn(`[Item Index ${index}] Could not convert minutes/seconds "${durationText}" to numbers.`);
                            }
                        } else {
                            console.warn(`[Item Index ${index}] Unexpected duration format "${durationText}" (expected MM:SS).`);
                        }
                    } else {
                        console.warn(`[Item Index ${index}] Duration element (${durationElementRelativeSelector}) not found in item.`);
                    }
                    // --- End Duration Extraction ---


                    // --- Title Extraction (Artist - Track) ---
                    const headingLinks = playlistItem.querySelectorAll(headingLinksRelativeSelector);

                    if (headingLinks.length >= 2) {
                        const artistElement = headingLinks[0];
                        const trackElement = headingLinks[1];

                        const artist = artistElement.textContent.trim(); // Get the artist's text, remove spaces
                        const track = trackElement.textContent.trim();   // Get the track's text, remove spaces

                        if (artist && track) {
                            title = `${artist} - ${track}`;
                        } else if (artist) {
                            title = `${artist} - Unknown Track`;
                        } else if (track) {
                            title = `Unknown Artist - ${track}`;
                        }
                    } else {
                         console.warn(`[Item Index ${index}] Could not find the two Artist/Track links in the item's heading.`);
                         // Title remains the fallback
                    }
                    // --- End Title Extraction ---

                } else {
                     console.warn(`[Item Index ${index}] The action link element is not contained within an expected .playlist__item parent.`);
                     // Title and Duration remain fallbacks
                }

                // Construct the complete M3U string for this track: #EXTINF:duration,Artist - Track\nfull_URL
                const m3uEntry = `#EXTINF:${duration},${title}\n${url}`;

                m3uEntries.push(m3uEntry); // Add the formatted string to the array
            } else {
                // Case: Found an action anchor, but without a valid href attribute
                console.warn(`[Item Index ${index}] Found an action link element matching the selector but without a valid href attribute.`);
            }
        });

        if (m3uEntries.length > 0) {
            console.log(`Formatted M3U playlist with ${m3uEntries.length} extracted tracks.`);

            const m3uContent = "#EXTM3U\n" + m3uEntries.join('\n');

            console.log('--- M3U Playlist Content ---');
            console.log(m3uContent);
            console.log('--- End M3U Playlist Content ---');

            // --- Filename Suggestion ---
            let suggestedFilename = 'playlist.m3u'; // Default fallback filename

            const albumHeaderElement = document.querySelector(albumHeaderSelector);

            if (albumHeaderElement) {
                 const headerText = albumHeaderElement.textContent.trim();
                 // Expected format: "Artist - Title (Year)"
                 const yearMatch = headerText.match(/\((\d{4})\)$/); // Regex to find (YYYY) at the end

                 let artist = 'Unknown Artist';
                 let albumTitle = 'Unknown Album';
                 let year = 'UnknownYear';

                 let textBeforeYear = headerText;

                 if (yearMatch && yearMatch[1]) {
                     year = yearMatch[1]; // The captured year (e.g., "1997")
                     // Remove the year part from the main string
                     textBeforeYear = headerText.substring(0, yearMatch.index).trim();
                 } else {
                     console.warn(`[Filename Suggestion] Could not find (YYYY) year pattern at the end of "${headerText}".`);
                 }

                 // Now parse "Artist - Title" from textBeforeYear
                 const separatorIndex = textBeforeYear.lastIndexOf(' - '); // Use lastIndexOf in case title has " - "

                 if (separatorIndex > 0) {
                     artist = textBeforeYear.substring(0, separatorIndex).trim();
                     albumTitle = textBeforeYear.substring(separatorIndex + 3).trim(); // +3 for " - "
                 } else {
                     // No " - " found, use the whole part as the album title
                     albumTitle = textBeforeYear || albumTitle; // Use the whole part if not empty
                     console.warn(`[Filename Suggestion] Could not find " - " separator in "${textBeforeYear}".`);
                 }

                 // Construct the suggested filename: artist_dell_album (anno_dell_album) - titolo_dell_album.m3u
                 // Replace characters invalid for filenames with underscores
                 suggestedFilename = `${artist} (${year}) - ${albumTitle}.m3u`.replace(/[\\/:*?"<>|]/g, '_');

                 console.log(`Suggested filename: ${suggestedFilename}`);

            } else {
                 console.warn(`Album header (${albumHeaderSelector}) not found. Cannot suggest filename.`);
            }
            // --- End Filename Suggestion ---

            // Update the copy instruction message to mention the suggested filename
            console.log('Copy the text between the "--- M3U Playlist Content ---" separators and save it to a file named e.g., "' + suggestedFilename + '"');

        } else {
             // This case occurs if actionAnchorElements.length > 0, but no valid track was created
            console.warn('No valid M3U tracks created. Verify the HTML structure and the presence of href, duration, and heading.');
        }
    } else {
        console.warn(`No action link element found with the initial selector:\n${actionLinkSelector}`);
    }
    console.log('--- End Processing ---');
})();
