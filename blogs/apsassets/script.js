// Prevent URL preview in status bar
document.addEventListener("mouseover", function (e) {
  if (
    e.target.tagName === "A" ||
    e.target.tagName === "BUTTON" ||
    e.target.getAttribute("role") === "button"
  ) {
    window.status = "";
    return false;
  }
});

// Additional prevention for all interactive elements
document.addEventListener("mouseover", function (e) {
  if (
    e.target.closest("a") ||
    e.target.closest("button") ||
    e.target.closest('[role="button"]')
  ) {
    window.status = "";
    return false;
  }
});

// Prevent default link behavior
document.querySelectorAll("a").forEach((link) => {
  link.addEventListener("mouseover", function (e) {
    e.preventDefault();
    return false;
  });
});

// --- Search Modal Logic ---

document.addEventListener("DOMContentLoaded", async function () {
  console.log("[Search Debug] DOMContentLoaded event fired.");
  const searchToggle = document.querySelector(".search-toggle");
  console.log("[Search Debug] searchToggle element:", searchToggle);
  const searchModal = document.getElementById("searchModal");
  const closeSearch = document.querySelector(".close-search");
  const searchInput = document.getElementById("searchInput");
  const searchTags = document.getElementById("searchTags");
  const searchArticles = document.getElementById("searchArticles");
  const clearSearchInputButton = document.getElementById("clearSearchInput");

  let blogData = []; // Store article data including content
  const tagMap = {}; // Store tag counts
  let activeTags = new Set(); // Change to Set to store multiple active tags
  let lastSearchQuery = ""; // Store the last search query

  // Function to disable body scroll
  function disableBodyScroll() {
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = "15px"; // Compensate for scrollbar width
  }

  // Function to enable body scroll
  function enableBodyScroll() {
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  }

  // Function to fetch article content
  async function fetchArticleContent(url) {
    console.log(`[Search Debug] Attempting to fetch: ${url}`);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(
          `[Search Debug] Failed to fetch ${url}: ${response.statusText}`
        );
        return null;
      }
      console.log(`[Search Debug] Successfully fetched: ${url}`);
      return await response.text();
    } catch (error) {
      console.error(`[Search Debug] Error fetching ${url}:`, error);
      return null;
    }
  }

  // Load blog data and fetch content
  async function loadBlogData() {
    console.log("[Search Debug] Starting loadBlogData for single page.");
    blogData = []; // Clear existing data
    activeTags = new Set(); // Clear active tags on reload (though not used for single page)
    searchTags.innerHTML = ""; // Clear tags UI (not used for single page)
    searchArticles.innerHTML = ""; // Clear articles UI

    try {
      // Get content directly from the current page's DOM
      const articleElement = document.querySelector("article");
      const fixedTocElement = document.querySelector(".fixed-toc");
      const pageTitle = document.title; // Get the title from the document
      const pageUrl = window.location.pathname; // Get the current page URL

      let sections = [];
      if (fixedTocElement) {
        const links = fixedTocElement.querySelectorAll("ul li a");
        links.forEach((link) => {
          const sectionTitle = link.textContent.trim();
          const href = link.getAttribute("href");
          if (href && href.startsWith("#")) {
            const sectionId = href.substring(1); // Remove the #
            sections.push({ title: sectionTitle, id: sectionId });
          }
        });
      }
      console.log(
        "[Search Debug] Extracted sections from current page:",
        sections
      );

      if (articleElement) {
        // --- Aggressive Content Cleaning ---
        const articleClone = articleElement.cloneNode(true); // Clone to avoid modifying the live DOM
        // Remove script, style, pre, and code elements
        articleClone
          .querySelectorAll("script, style, pre, code")
          .forEach((el) => el.remove());

        // Get the plain text content after removing specified elements
        const cleanContent =
          articleClone.textContent || articleClone.innerText || "";

        blogData.push({
          title: pageTitle,
          url: pageUrl,
          tags: [], // No tags for a single page search
          content: articleElement.innerHTML, // Store the original article HTML content
          plainTextContent: cleanContent, // Store the cleaned plain text content
          sections: sections, // Store the extracted sections data
        });
        console.log(
          "[Search Debug] Added current page article data:",
          blogData[0]
        );

        // Tags are not used for single page search, no need to update tagMap or renderTags

        // Perform initial search if there is a query in the input
        if (searchInput.value.trim() !== "") {
          filterArticles();
        }
      } else {
        console.error(
          "[Search Debug] Could not find the article element on the page."
        );
      }
    } catch (error) {
      console.error(
        "[Search Debug] Error loading current page article data:",
        error
      );
    }
  }

  function renderTags() {
    const tags = Object.keys(tagMap).sort();
    searchTags.innerHTML =
      "<ul>" +
      tags
        .map((tag) => {
          // Calculate count based on articles where the tag is present
          const count = blogData.filter((article) =>
            article.tags.includes(tag)
          ).length;
          const id = `tag-filter-${tag.replace(/[^a-zA-Z0-9]/g, "-")}`; // Create a valid ID
          return `
    <li class="tag-filter">
      <input type="checkbox" id="${id}" data-tag="${tag}" ${
            activeTags.has(tag) ? "checked" : ""
          }>
      <label for="${id}">
        <span class="custom-checkbox"></span>
        <span class="tag-text">${tag}</span>
        <span class="tag-count">(${count})</span>
      </label>
    </li>
  `;
        })
        .join("") +
      "</ul>";
    console.log("[Search Debug] Tags rendered. tagMap:", tagMap);
  }

  function filterArticles() {
    console.log("[Search Debug] Starting filterArticles.");
    const query = searchInput.value.trim().toLowerCase();
    lastSearchQuery = query;

    if (query.length < 2) {
      searchArticles.innerHTML = ""; // Clear results if query is too short
      return;
    }

    const results = [];

    // Assuming blogData has only one entry for the current page
    if (blogData.length === 0) {
      console.warn("[Search Debug] blogData is empty. Cannot filter.");
      return;
    }

    const article = blogData[0];
    const plainText = article.plainTextContent.toLowerCase();
    const originalContent = article.content; // Use original HTML for accurate snippet extraction
    const sections = article.sections; // Use extracted sections

    let matchIndex = plainText.indexOf(query);
    while (matchIndex !== -1) {
      const section = findSectionTitle(originalContent, matchIndex, plainText);

      // Only include results that have a valid section with an ID
      if (section && section.id) {
        const snippet = extractSnippetFromPlainText(
          article.plainTextContent,
          query,
          matchIndex
        );

        results.push({
          title: article.title, // Still include article title for consistency
          url: article.url,
          section: section.title, // Use section title
          sectionId: section.id, // Include section ID
          snippet: snippet,
        });
      }

      matchIndex = plainText.indexOf(query, matchIndex + 1);
    }

    renderArticles(results);
    console.log("[Search Debug] Finished filterArticles.", results);
  }

  function renderArticles(results) {
    console.log("[Search Debug] Rendering articles for single page.", results);
    const searchResultsContainer = document.getElementById("searchArticles"); // Assuming this is where we want to render
    searchResultsContainer.innerHTML = ""; // Clear previous results

    if (results.length === 0) {
      // Optionally display a message if no results are found
      searchResultsContainer.innerHTML = "<p>No results found :-/</p>";
      return;
    }

    // Group results by sectionId
    const groupedResults = results.reduce((acc, result) => {
      const sectionId = result.sectionId || "general"; // Use 'general' for results without sectionId (shouldn't happen with current filter)
      if (!acc[sectionId]) {
        acc[sectionId] = {
          sectionTitle: result.section,
          sectionId: result.sectionId,
          url: result.url, // Assuming all results are from the same page URL
          snippets: [],
        };
      }
      acc[sectionId].snippets.push(result.snippet);
      return acc;
    }, {});

    // Render grouped results
    Object.values(groupedResults).forEach((sectionGroup) => {
      searchResultsContainer.innerHTML += `
      <div class="search-section-group">
        <div class="search-section-header">
          <a href="${sectionGroup.url}#${sectionGroup.sectionId}">${
        sectionGroup.sectionTitle
      }</a>
        </div>
        <div class="section-snippets">
          ${sectionGroup.snippets
            .map(
              (snippet) => `
            <div class="snippet-item">
              <i class="fas fa-chevron-right snippet-arrow"></i> <!-- Arrow Icon for Snippet -->
              <p>${snippet}</p>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
    });

    console.log("[Search Debug] Rendered search results.");

    // Add click listeners to section links in search results
    const sectionLinks = searchResultsContainer.querySelectorAll(
      ".search-section-header a"
    );
    sectionLinks.forEach((link) => {
      link.addEventListener("click", function (e) {
        e.preventDefault(); // Prevent default anchor link behavior

        const targetId = this.getAttribute("href").split("#")[1]; // Get section ID from href
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
          // Close the search modal
          const searchModal = document.getElementById("searchModal");
          if (searchModal) {
            searchModal.style.display = "none";
            enableBodyScroll(); // Enable body scroll
          }

          // Scroll to the target element
          targetElement.scrollIntoView({
            behavior: "smooth",
          });

          // Update the URL hash without jumping
          history.pushState(null, null, `#${targetId}`);

          // Highlight searched text in the main page
          const searchQuery = searchInput.value.trim();
          if (searchQuery) {
            console.log("[Search Debug] Attempting to highlight:", searchQuery);

            // Remove any existing highlights
            document.querySelectorAll(".search-highlight").forEach((el) => {
              const parent = el.parentNode;
              if (parent) {
                const textNode = document.createTextNode(el.textContent);
                parent.replaceChild(textNode, el);
                parent.normalize();
              }
            });

            // Create a new highlight
            const walker = document.createTreeWalker(
              targetElement,
              NodeFilter.SHOW_TEXT,
              {
                acceptNode: function (node) {
                  // Skip script and style tags
                  if (
                    node.parentNode.tagName === "SCRIPT" ||
                    node.parentNode.tagName === "STYLE" ||
                    node.parentNode.tagName === "PRE" ||
                    node.parentNode.tagName === "CODE"
                  ) {
                    return NodeFilter.FILTER_REJECT;
                  }
                  return NodeFilter.FILTER_ACCEPT;
                },
              },
              false
            );

            const nodesToHighlight = [];
            let node;
            while ((node = walker.nextNode())) {
              if (
                node.textContent
                  .toLowerCase()
                  .includes(searchQuery.toLowerCase())
              ) {
                nodesToHighlight.push(node);
              }
            }

            console.log(
              "[Search Debug] Found nodes to highlight:",
              nodesToHighlight.length
            );

            nodesToHighlight.forEach((node) => {
              try {
                const text = node.textContent;
                const regex = new RegExp(
                  `(${searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")})`,
                  "gi"
                );
                const newText = text.replace(
                  regex,
                  '<span class="search-highlight">$1</span>'
                );

                // Create a temporary container
                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = newText;

                // Replace the text node with the highlighted content
                const fragment = document.createDocumentFragment();
                while (tempDiv.firstChild) {
                  fragment.appendChild(tempDiv.firstChild);
                }
                node.parentNode.replaceChild(fragment, node);
              } catch (error) {
                console.error("[Search Debug] Error highlighting node:", error);
              }
            });

            // Add highlight style if not already present
            if (!document.getElementById("search-highlight-style")) {
              const style = document.createElement("style");
              style.id = "search-highlight-style";
              style.textContent = `
                           .search-highlight {
                               background-color: var(--accent-color);
                               color: var(--bg-color);
                               padding: 2px 4px;
                               border-radius: 3px;
                               transition: background-color 0.3s ease;
                               display: inline;
                           }
                       `;
              document.head.appendChild(style);
            }
          }
        } else {
          console.warn(
            `[Search Debug] Target element with ID ${targetId} not found.`
          );
        }
      });
    });
  }

  function extractSnippet(content, query, sectionTitle) {
    // Use a temporary element to get the plain text content of the whole article
    const fullTextTempDiv = document.createElement("div");
    fullTextTempDiv.innerHTML = content;
    const fullTextContent =
      fullTextTempDiv.textContent || fullTextTempDiv.innerText || "";
    const fullTextContentLower = fullTextContent.toLowerCase();

    let textToSearch = fullTextContent;
    let baseIndex = 0;

    // Attempt to find the section in the original HTML and then get its text content
    const sectionRegex = new RegExp(
      `(?:<h[1-6][^>]*?>\s*${sectionTitle.replace(
        /[-\/\\^$*+?.()|[\\]{}]/g,
        "\\$&"
      )}\s*<\\/h[1-6]>)([\\s\\S]*?)`,
      "i"
    );
    const sectionMatch = sectionRegex.exec(content);

    if (sectionMatch && sectionMatch[1]) {
      // Use a temporary element to get the plain text content of the section
      const sectionTextTempDiv = document.createElement("div");
      sectionTextTempDiv.innerHTML = sectionMatch[1];
      textToSearch =
        sectionTextTempDiv.textContent || sectionTextTempDiv.innerText || "";

      // Find the starting index of this section's text content within the full plain text content
      baseIndex = fullTextContentLower.indexOf(textToSearch.toLowerCase());
      if (baseIndex === -1) baseIndex = 0; // Fallback if not found (shouldn't happen if logic is correct)
    } else {
      // If section not found or no content after heading, search in full plain text
      textToSearch = fullTextContent;
      baseIndex = 0;
    }

    const textToSearchLower = textToSearch.toLowerCase();
    const queryIndex = textToSearchLower.indexOf(query.toLowerCase());

    if (queryIndex !== -1) {
      const start = Math.max(0, queryIndex - 50); // Get up to 50 chars before
      const end = Math.min(
        textToSearch.length,
        queryIndex + query.length + 150
      ); // Get up to 150 chars after
      let snippet = textToSearch.substring(start, end);

      // Simple highlighting
      const highlightRegex = new RegExp(
        `(${query.replace(/[-\/\\^$*+?.()|[\\]{}]/g, "\\$&")})`,
        "gi"
      );
      snippet = snippet.replace(highlightRegex, "<mark>$1</mark>");

      // Add ellipses if snippet is truncated
      if (start > 0) snippet = "..." + snippet;
      if (end < textToSearch.length) snippet = snippet + "...";

      return snippet.trim();
    }

    // Fallback: if no match found in the determined section/full text, return default
    return "..."; // Default empty snippet if no match found
  }

  function extractSnippetFromPlainText(plainText, query, matchIndex) {
    const queryLower = query.toLowerCase();
    const plainTextLower = plainText.toLowerCase();

    // Ensure matchIndex is within bounds and actually corresponds to the query
    if (
      matchIndex === -1 ||
      plainTextLower.substring(matchIndex, matchIndex + queryLower.length) !==
        queryLower
    ) {
      console.error(
        "[Search Debug] Snippet extraction called with incorrect match index.",
        { plainText, query, matchIndex }
      );
      return "..."; // Return a default snippet or handle error
    }

    const start = Math.max(0, matchIndex - 50); // Get up to 50 chars before
    const end = Math.min(plainText.length, matchIndex + query.length + 150); // Get up to 150 chars after
    let snippet = plainText.substring(start, end);

    // Find word boundaries for the match
    const wordStart = snippet.lastIndexOf(" ", matchIndex - start) + 1;
    const wordEnd = snippet.indexOf(" ", matchIndex - start + query.length);
    const wordEndIndex = wordEnd === -1 ? snippet.length : wordEnd;

    // Get the full word containing the match
    const fullWord = snippet.substring(wordStart, wordEndIndex);

    // Replace the full word with the highlighted version
    const highlightedWord = `<span style="color: var(--accent-color);">${fullWord}</span>`;
    snippet =
      snippet.substring(0, wordStart) +
      highlightedWord +
      snippet.substring(wordEndIndex);

    // Add ellipses if snippet is truncated
    if (start > 0) snippet = "..." + snippet;
    if (end < plainText.length) snippet = snippet + "...";

    return snippet.trim();
  }

  function findSectionTitle(
    originalHtmlContent,
    plainTextMatchIndex,
    plainTextContent
  ) {
    // This function tries to find the section title based on the plain text index
    // and then looks up the ID in the pre-parsed sections data.
    // It no longer relies on mapping plain text index directly to HTML element ID.

    console.log(
      "[Search Debug] findSectionTitle called for plainTextMatchIndex:",
      plainTextMatchIndex
    );

    const parser = new DOMParser();
    const doc = parser.parseFromString(originalHtmlContent, "text/html");
    const headings = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");
    let closestHeadingText = "General"; // Default section text

    // Find the closest preceding heading text in the original HTML based on approximate position
    // We still need to find the closest heading text to look it up in our sections data.
    let htmlApproxIndex = 0;
    let plainTextApproxIndex = 0;
    const walk = document.createTreeWalker(
      doc.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    let node;
    while ((node = walk.nextNode())) {
      const nodeText = node.textContent || "";
      if (plainTextApproxIndex + nodeText.length > plainTextMatchIndex) {
        // The match is in this text node or just before it.
        // Find the index of this text node in the original HTML (approximate).
        const nodeHtmlIndex = originalHtmlContent.indexOf(
          nodeText,
          htmlApproxIndex
        );
        if (nodeHtmlIndex !== -1) {
          htmlApproxIndex = nodeHtmlIndex;
          break; // Found an approximate HTML index for the match location
        }
      }
      const nodeHtmlIndex = originalHtmlContent.indexOf(
        nodeText,
        htmlApproxIndex
      );
      if (nodeHtmlIndex !== -1) {
        htmlApproxIndex = nodeHtmlIndex + nodeText.length;
      } else {
        htmlApproxIndex += nodeText.length; // Fallback
      }

      plainTextApproxIndex += nodeText.length;
    }
    console.log(
      "[Search Debug] Approximated HTML index for finding closest heading text:",
      htmlApproxIndex
    );

    for (let i = headings.length - 1; i >= 0; i--) {
      const heading = headings[i];
      const headingOuterHTMLIndex = originalHtmlContent.indexOf(
        heading.outerHTML
      );
      if (headingOuterHTMLIndex === -1) continue;

      const headingEndIndex = headingOuterHTMLIndex + heading.outerHTML.length;
      if (headingEndIndex < htmlApproxIndex) {
        closestHeadingText = heading.textContent.trim();
        console.log(
          "[Search Debug] Found closest heading text:",
          closestHeadingText
        );
        break;
      }
    }

    // Now look up the section ID in the pre-parsed sections data
    const articleData = blogData.find(
      (article) => article.content === originalHtmlContent
    ); // Find the article data
    let sectionId = null;
    if (articleData && articleData.sections) {
      const section = articleData.sections.find(
        (sec) => sec.title === closestHeadingText
      );
      if (section) {
        sectionId = section.id;
      }
    }
    console.log("[Search Debug] Looked up section ID:", sectionId);

    return { title: closestHeadingText, id: sectionId }; // Return the found section title and ID
  }

  // Open modal
  if (searchToggle) {
    searchToggle.addEventListener("click", async () => {
      console.log("[Search Debug] Search toggle clicked");
      searchModal.style.display = "flex";
      disableBodyScroll(); // Disable body scroll
      if (blogData.length === 0) {
        // Load data only if not loaded
        console.log("[Search Debug] blogData is empty, loading data.");
        searchArticles.innerHTML =
          '<p style="color:var(--secondary-text-color);">Loading articles...</p>';
        await loadBlogData();
      } else {
        console.log("[Search Debug] blogData already loaded.");
      }
      renderTags();
      // Restore last search query and results
      searchInput.value = lastSearchQuery;
      if (lastSearchQuery) {
        clearSearchInputButton.style.display = "block";
      }
      filterArticles(); // Filter after data is loaded
      searchInput.focus();
    });
  } else {
    console.error("[Search Debug] Search toggle element not found!");
  }

  // Close modal
  closeSearch.addEventListener("click", () => {
    console.log("[Search Debug] Close button clicked");
    searchModal.style.display = "none";
    enableBodyScroll(); // Enable body scroll
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      console.log("[Search Debug] Escape key pressed");
      searchModal.style.display = "none";
      enableBodyScroll(); // Enable body scroll
    }
  });

  // Tag filter click
  searchTags.addEventListener("change", (e) => {
    console.log("[Search Debug] Tag area change event");
    const checkbox = e.target.closest('input[type="checkbox"]');
    if (checkbox) {
      const tag = checkbox.getAttribute("data-tag");
      console.log(
        `[Search Debug] Checkbox changed for tag: ${tag}, checked: ${checkbox.checked}`
      );

      if (checkbox.checked) {
        activeTags.add(tag);
        checkbox.closest("li.tag-filter")?.classList.add("active");
      } else {
        activeTags.delete(tag);
        checkbox.closest("li.tag-filter")?.classList.remove("active");
      }

      filterArticles();
    }
  });

  // Search input
  searchInput.addEventListener("input", () => {
    lastSearchQuery = searchInput.value.trim(); // Store the current search query

    // Check for "apple" trigger
    if (searchInput.value.toLowerCase() === "apple") {
      createBootAnimation();
    }

    filterArticles();
    // Show/hide clear button based on input value
    if (searchInput.value.length > 0) {
      clearSearchInputButton.style.display = "block";
    } else {
      clearSearchInputButton.style.display = "none";
    }
  });

  // Create iOS boot animation
  function createBootAnimation() {
    // Create container
    const container = document.createElement("div");
    container.className = "ios-boot-container";

    // Create Apple logo
    const logo = document.createElement("div");
    logo.className = "ios-boot-logo";
    logo.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.41-1.09-.47-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.41C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.78 1.18-.19 2.31-.89 3.51-.84 1.54.07 2.7.61 3.44 1.57-3.14 1.88-2.29 5.98.48 7.13-.65 1.48-1.52 2.95-2.51 4.33zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
        </svg>
    `;

    // Create loading bar
    const loadingBar = document.createElement("div");
    loadingBar.className = "ios-boot-bar";

    // Add styles
    const style = document.createElement("style");
    style.textContent = `
        .ios-boot-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: var(--bg-color);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            opacity: 0;
            animation: fadeIn 0.5s ease forwards;
        }
        
        .ios-boot-logo {
            width: 80px;
            height: 80px;
            color: var(--text-color);
            margin-bottom: 40px;
            opacity: 0;
            animation: logoFadeIn 0.5s ease 0.3s forwards;
        }
        
        .ios-boot-bar {
            width: 200px;
            height: 2px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
            overflow: hidden;
            position: relative;
        }
        
        .ios-boot-bar::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: var(--accent-color);
            transform: translateX(-100%);
            animation: loadingBar 2s ease-in-out forwards;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes logoFadeIn {
            from { 
                opacity: 0;
                transform: scale(0.8);
            }
            to { 
                opacity: 1;
                transform: scale(1);
            }
        }
        
        @keyframes loadingBar {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(0); }
        }
    `;
    document.head.appendChild(style);

    // Add elements to container
    container.appendChild(logo);
    container.appendChild(loadingBar);
    document.body.appendChild(container);

    // Remove animation after completion
    setTimeout(() => {
      container.style.animation = "fadeIn 0.5s ease reverse forwards";
      setTimeout(() => {
        container.remove();
      }, 500);
    }, 2500);
  }

  // Clear search input button
  clearSearchInputButton.addEventListener("click", () => {
    searchInput.value = "";
    lastSearchQuery = ""; // Clear the stored search query
    clearSearchInputButton.style.display = "none";
    filterArticles(); // Update results after clearing
    searchInput.focus(); // Put focus back in the search box
  });

  // Initial data load (optional, can load on modal open)
  // loadBlogData();
});

// --- Scroll to Next Section Button Logic (Mobile) ---

document.addEventListener("DOMContentLoaded", function () {
  const scrollButton = document.getElementById("scrollToNextSection");
  if (!scrollButton) return;

  let isScrolling = false;
  let arrowSequence = [];
  const konamiCode = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "b",
    "a",
  ];

  function findNextHeading() {
    const headings = document.querySelectorAll("h2, h3");
    const headerHeight = document.querySelector("header").offsetHeight;
    const currentScroll = window.pageYOffset + headerHeight;

    for (let heading of headings) {
      const headingTop =
        heading.getBoundingClientRect().top + window.pageYOffset;
      if (headingTop > currentScroll) {
        return heading;
      }
    }
    return null;
  }

  function scrollToElement(element) {
    if (isScrolling) return;
    isScrolling = true;

    if (!element) {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
      setTimeout(() => {
        isScrolling = false;
        updateScrollButton();
      }, 800);
      return;
    }

    const headerHeight = document.querySelector("header").offsetHeight;
    const elementPosition =
      element.getBoundingClientRect().top + window.pageYOffset;
    const offsetPosition = Math.floor(elementPosition - headerHeight);

    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth",
    });

    setTimeout(() => {
      isScrolling = false;
      updateScrollButton();
    }, 800);
  }

  function isAtBottomOfPage() {
    const scrollPosition = window.pageYOffset + window.innerHeight;
    const pageHeight = document.documentElement.scrollHeight;
    return scrollPosition >= pageHeight;
  }

  function updateScrollButton() {
    const nextHeading = findNextHeading();
    const isBottom = isAtBottomOfPage();

    const icon = scrollButton.querySelector("i");
    if (isBottom || !nextHeading) {
      icon.className = "fas fa-chevron-up";
    } else {
      icon.className = "fas fa-chevron-down";
    }
  }

  function createMatrixRain() {
    const canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "9999";
    canvas.style.opacity = "1";
    canvas.style.transition = "opacity 3s ease-in-out";
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // More aesthetic character set with Apple-inspired symbols
    const chars = "◊⌘⌥⇧⎋⌫⏎⌃⌤⌅⎋⌘⌥⇧⎋⌫⏎⌃⌤⌅⎋";
    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const drops = [];
    let mouseX = 0;
    let mouseY = 0;

    // Track mouse position
    document.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    for (let i = 0; i < columns; i++) {
      drops[i] = 1;
    }

    function draw() {
      // More subtle trail effect
      ctx.fillStyle = "rgba(0, 0, 0, 0.02)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // Calculate distance from mouse
        const dx = x - mouseX;
        const dy = y - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 200; // Maximum distance for effect
        const influence = Math.max(0, 1 - distance / maxDistance);

        // Subtle monochrome gradient effect with mouse influence
        const opacity =
          (Math.sin(Date.now() * 0.001 + i * 0.1) * 0.3 + 0.7) *
          (1 + influence * 0.5);
        const lightness =
          80 + Math.sin(Date.now() * 0.0005 + i * 0.05) * 10 + influence * 20;
        ctx.fillStyle = `hsla(0, 0%, ${lightness}%, ${opacity})`;

        // Add slight position offset based on mouse position
        const offsetX = dx * influence * 0.1;
        const offsetY = dy * influence * 0.1;

        ctx.fillText(text, x + offsetX, y + offsetY);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    }

    const interval = setInterval(draw, 33);

    // Start fading out after 5 seconds
    setTimeout(() => {
      canvas.style.opacity = "0";
    }, 5000);

    // Remove the canvas after fade out completes
    setTimeout(() => {
      clearInterval(interval);
      canvas.remove();
    }, 8000);
  }

  function checkKonamiCode(key) {
    arrowSequence.push(key);
    if (arrowSequence.length > konamiCode.length) {
      arrowSequence.shift();
    }

    if (arrowSequence.join(",") === konamiCode.join(",")) {
      // Easter egg triggered!
      const nameElement = document.querySelector(".header-title span");
      if (nameElement) {
        // Add custom cursor style
        const style = document.createElement("style");
        style.textContent = `
          .header-title span {
            cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>') 12 12, auto;
            transition: all 0.3s ease;
            background: transparent !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .header-title span:hover {
            color: var(--accent-color);
            transform: scale(1.05);
            background: transparent !important;
            box-shadow: none !important;
          }
        `;
        document.head.appendChild(style);
      }
      createMatrixRain();
      arrowSequence = []; // Reset sequence
    }
  }

  scrollButton.addEventListener("click", function () {
    if (isScrolling) return;

    if (isAtBottomOfPage() || !findNextHeading()) {
      scrollToElement(null);
    } else {
      const nextHeading = findNextHeading();
      scrollToElement(nextHeading);
    }
  });

  window.addEventListener("scroll", function () {
    if (!isScrolling) {
      updateScrollButton();
    }
  });

  // Add keyboard event listener for arrow sequence
  document.addEventListener("keydown", function (e) {
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "a", "b"].includes(
        e.key
      )
    ) {
      checkKonamiCode(e.key);
    }
  });

  updateScrollButton();
});

document.addEventListener("DOMContentLoaded", function () {
  // Search functionality
  const searchToggle = document.querySelector(".search-toggle");
  const searchModal = document.getElementById("searchModal");
  const closeSearch = document.querySelector(".close-search");
  const searchInput = document.getElementById("searchInput");
  const clearSearchInput = document.getElementById("clearSearchInput");

  // Toggle search modal
  searchToggle.addEventListener("click", function () {
    searchModal.style.display = "flex";
    searchInput.focus();
  });

  closeSearch.addEventListener("click", function () {
    searchModal.style.display = "none";
    searchInput.value = "";
    clearSearchInput.style.display = "none";
  });

  // Clear search input
  clearSearchInput.addEventListener("click", function () {
    searchInput.value = "";
    clearSearchInput.style.display = "none";
    searchInput.focus();
  });

  // Show/hide clear button based on input
  searchInput.addEventListener("input", function () {
    clearSearchInput.style.display = this.value ? "block" : "none";
  });

  // Close modal when clicking outside
  searchModal.addEventListener("click", function (e) {
    if (e.target === searchModal) {
      searchModal.style.display = "none";
      searchInput.value = "";
      clearSearchInput.style.display = "none";
    }
  });

  // Scroll to next section button
  const scrollButton = document.getElementById("scrollToNextSection");

  function updateScrollButton() {
    const scrollPosition = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    if (scrollPosition + windowHeight < documentHeight - 100) {
      scrollButton.classList.add("visible");
    } else {
      scrollButton.classList.remove("visible");
    }
  }

  scrollButton.addEventListener("click", function () {
    const sections = document.querySelectorAll("section[id], h2[id], h3[id]");
    const scrollPosition = window.scrollY + window.innerHeight * 0.3;

    for (let section of sections) {
      if (section.offsetTop > scrollPosition) {
        window.scrollTo({
          top: section.offsetTop - 100,
          behavior: "smooth",
        });
        break;
      }
    }
  });

  // Update scroll button visibility on scroll
  window.addEventListener("scroll", function () {
    if (!window.requestAnimationFrame) {
      updateScrollButton();
    } else {
      window.requestAnimationFrame(updateScrollButton);
    }
  });

  // Initial scroll button state
  updateScrollButton();

  // Table of Contents functionality
  const tocSections = document.querySelectorAll(".toc-section");
  const toc = document.querySelector(".fixed-toc");

  function centerTOC() {
    const tocHeight = toc.offsetHeight;
    const windowHeight = window.innerHeight;
    const newTop = (windowHeight - tocHeight) / 2;
    toc.style.top = newTop + "px";
    toc.style.transform = "none";
  }

  // Add collapse/expand buttons and handle navigation
  tocSections.forEach((section) => {
    const link = section.querySelector("a");
    const hasSubsections = section.querySelector("ul");

    if (hasSubsections) {
      // Create collapse/expand button
      const toggleButton = document.createElement("button");
      toggleButton.className = "toc-toggle";
      toggleButton.innerHTML = '<i class="fas fa-chevron-down"></i>';
      toggleButton.setAttribute("aria-label", "Toggle section");

      // Style the toggle button
      const style = document.createElement("style");
      style.textContent = `
      .toc-toggle {
        background: none;
        border: none;
        color: var(--text-color);
        cursor: pointer;
        padding: 0 5px;
        font-size: 0.8em;
        opacity: 0.7;
        transition: transform 0.3s ease, opacity 0.3s ease;
      }
      .toc-toggle:hover {
        opacity: 1;
      }
      .toc-section.collapsed .toc-toggle {
        transform: rotate(-90deg);
      }
      .toc-section > a {
        display: inline-flex;
        align-items: center;
        text-decoration: none;
      }
      .toc-section > a::before {
        content: none !important;
      }
      .toc-section ul {
        margin-left: 2.5em;
        padding-left: 0.8em;
        border-left: 1px solid var(--text-color);
        opacity: 0.85;
      }
      .toc-section ul li {
        margin: 0.4em 0;
      }
      .toc-section ul li a {
        font-size: 0.9em;
        opacity: 0.9;
        transition: color 0.2s ease;
        color: var(--text-color);
        text-decoration: none;
        display: block;
        padding: 0.2em 0;
      }
      .toc-section ul li a:hover {
        opacity: 1;
        color: var(--accent-color);
      }
    `;
      document.head.appendChild(style);

      // Insert toggle button before the link
      section.insertBefore(toggleButton, link);

      // Handle collapse/expand
      toggleButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        section.classList.toggle("collapsed");
        setTimeout(centerTOC, 300);
      });
    }

    // Handle navigation
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const targetId = this.getAttribute("href").substring(1);
      const targetElement = document.getElementById(targetId);

      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: "smooth",
        });

        // Update URL hash without jumping
        history.pushState(null, null, `#${targetId}`);
      }
    });
  });

  // Initial TOC centering
  centerTOC();

  // Add favicon hover effect
  const favicon = document.querySelector(".favicon");

  favicon.addEventListener("mousemove", (e) => {
    const tooltip = favicon.querySelector("::before");
    if (tooltip) {
      tooltip.style.left = e.clientX + "px";
      tooltip.style.top = e.clientY + "px";
    }
  });

  // Add scroll to next section functionality
  document.addEventListener("DOMContentLoaded", function () {
    const scrollButton = document.getElementById("scrollToNextSection");
    if (!scrollButton) return;

    function findNextHeading() {
      const headings = document.querySelectorAll("h2, h3");
      const headerHeight = document.querySelector("header").offsetHeight;
      const currentScroll = window.pageYOffset + headerHeight + 10; // Add small buffer

      for (let heading of headings) {
        const headingTop =
          heading.getBoundingClientRect().top + window.pageYOffset;
        if (headingTop > currentScroll) {
          return heading;
        }
      }
      return null; // No more headings found
    }

    function scrollToElement(element) {
      if (!element) {
        // If no next heading found, scroll to top
        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
        return;
      }

      const headerHeight = document.querySelector("header").offsetHeight;
      const elementPosition =
        element.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - headerHeight;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }

    function isAtBottomOfPage() {
      const scrollPosition = window.pageYOffset + window.innerHeight;
      const pageHeight = document.documentElement.scrollHeight;
      return scrollPosition >= pageHeight - 50; // 50px threshold
    }

    function updateScrollButton() {
      const scrollButton = document.getElementById("scrollToNextSection");
      if (!scrollButton) return;

      const nextHeading = findNextHeading();
      const isBottom = isAtBottomOfPage();

      // Update button icon based on position
      const icon = scrollButton.querySelector("i");
      if (isBottom || !nextHeading) {
        icon.className = "fas fa-chevron-up";
      } else {
        icon.className = "fas fa-chevron-down";
      }
    }

    scrollButton.addEventListener("click", function () {
      if (isAtBottomOfPage()) {
        // Scroll to top
        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      } else {
        // Scroll to next section
        const nextHeading = findNextHeading();
        scrollToElement(nextHeading);
      }
    });

    // Update button on scroll
    window.addEventListener("scroll", updateScrollButton);
    // Initial update
    updateScrollButton();
  });

  // Create jump to top button
  const jumpToTopButton = document.createElement("button");
  jumpToTopButton.id = "jumpToTop";
  jumpToTopButton.className = "jump-to-top";
  jumpToTopButton.innerHTML = '<i class="fas fa-arrow-up"></i>';
  jumpToTopButton.setAttribute("aria-label", "Jump to top");
  document.body.appendChild(jumpToTopButton);

  // Add styles for the jump to top button
  const style = document.createElement("style");
  style.textContent = `
  .jump-to-top {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: var(--bg-color);
    color: var(--text-color);
    border: 1px solid var(--text-color);
    opacity: 0.6;
    cursor: pointer;
    display: none;
    align-items: center;
    justify-content: center;
    font-size: 0.9em;
    transition: all 0.2s ease;
    z-index: 1000;
  }

  .jump-to-top:hover {
    opacity: 1;
    transform: translateY(-2px);
  }

  .jump-to-top.visible {
    display: flex;
  }

  @media (max-width: 768px) {
    .jump-to-top {
      display: none !important;
    }
  }
`;
  document.head.appendChild(style);

  // Function to handle scroll events
  function handleScroll() {
    const scrollPosition = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    // Show button when scrolled down more than 300px
    if (scrollPosition > 300) {
      jumpToTopButton.classList.add("visible");
    } else {
      jumpToTopButton.classList.remove("visible");
    }
  }

  // Add scroll event listener
  window.addEventListener("scroll", handleScroll);

  // Add click event listener to jump to top
  jumpToTopButton.addEventListener("click", function () {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });

  // Initial check for scroll position
  handleScroll();
});

document.addEventListener("DOMContentLoaded", (event) => {
  // Initialize highlight.js
  hljs.configure({
    ignoreUnescapedHTML: true,
    languages: ["python"],
  });

  // Function to update syntax highlighting theme
  function updateSyntaxTheme() {
    const isDarkMode =
      document.documentElement.getAttribute("data-theme") === "dark";
    const darkTheme = document.getElementById("dark-theme");
    const lightTheme = document.getElementById("light-theme");

    if (isDarkMode) {
      darkTheme.disabled = false;
      lightTheme.disabled = true;
    } else {
      darkTheme.disabled = true;
      lightTheme.disabled = false;
    }

    // Re-highlight all code blocks
    document.querySelectorAll("pre code").forEach((el) => {
      hljs.highlightElement(el);
    });
  }

  // Initial highlight
  document.querySelectorAll("pre code").forEach((el) => {
    hljs.highlightElement(el);
  });

  // Update theme when theme changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "data-theme") {
        updateSyntaxTheme();
      }
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  // Initial theme setup
  updateSyntaxTheme();
});
