/*!
 * Instant Data Scraper Table Detection Algorithm - Demo Implementation
 * 
 * This script demonstrates the core table detection algorithm used by the 
 * Instant Data Scraper Chrome extension. It identifies tabular data on web
 * pages by analyzing structural patterns rather than relying on HTML <table> tags.
 * 
 * How to use:
 * 1. Include this script after jQuery in your webpage
 * 2. Call findTables() to get potential table candidates
 * 3. Each candidate includes a selector, score, and metadata
 * 
 * Note: This is a simplified demo version. The actual extension includes
 * additional features like pagination handling, data extraction, and UI.
 */

// Utility function: Gets class names as an array
// Equivalent to the 'o' function in the original extension
function getClasses(element) {
    // Get class attribute, split by whitespace, filter out empty strings
    return ($(element).attr("class") || "")
        .trim()
        .split(/\s+/)
        .filter(function (cls) { return cls.length > 0; });
}

// Utility function: Escapes special CSS selectors in strings
// Equivalent to the 't' function in the original extension
function escapeSelector(str, prefix) {
    return (prefix || ".") +
        str.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, "\\$&").trim();
}

// Utility function: Gets text content excluding child elements
// Equivalent to the 'u' function in the original extension
function getDirectText(element) {
    return $(element).clone() // Clone the element
        .children()           // Select all children
        .remove()             // Remove them from the clone
        .end()                // Go back to the cloned element
        .text();              // Get text content
}

/**
 * Core Detection Algorithm
 * Analyzes an element to see if its children form a consistent pattern
 * 
 * @param {jQuery} element - The element to analyze
 * @returns {Object} - Contains matching children and their common class patterns
 */
function detectTablePattern(element) {
    // Get all children that are not script, img, meta, or style elements
    // and have some text content
    var children = $(element).children().filter(function () {
        var nodeName = this.nodeName.toLowerCase();
        return !["script", "img", "meta", "style"].includes(nodeName) &&
            $(this).text().trim().length > 0;
    });

    // If no valid children, return empty result
    if (children.length === 0) {
        return { children: [], goodClasses: [] };
    }

    // Objects to track class frequencies
    var classFreq = {};      // Frequency of individual classes
    var classComboFreq = {}; // Frequency of class combinations

    // Analyze each child element
    children.each(function () {
        // Get sorted list of classes for this child
        var classes = getClasses(this).sort();
        var classCombo = classes.join(" ");

        // Count this class combination
        if (!(classCombo in classComboFreq)) {
            classComboFreq[classCombo] = 0;
        }
        classComboFreq[classCombo]++;

        // Count each individual class in this combination
        classes.forEach(function (cls) {
            if (!(cls in classFreq)) {
                classFreq[cls] = 0;
            }
            classFreq[cls]++;
        });
    });

    // Find class combinations that appear in at least half the children
    // (minus 2 as a buffer for minor variations)
    var threshold = Math.floor(children.length / 2) - 2;
    var goodClassCombos = Object.keys(classComboFreq).filter(function (combo) {
        return classComboFreq[combo] >= threshold;
    });

    // If no good combinations found, try individual classes
    if (goodClassCombos.length === 0) {
        var goodClasses = Object.keys(classFreq).filter(function (cls) {
            return classFreq[cls] >= threshold;
        });

        // Special case handling from original: if element is very large but
        // we still don't have patterns, or only have empty string class
        if ($(element).width() * $(element).height() > 50000 && classComboFreq.length &&
            (goodClasses.length === 0 || (goodClasses.length === 1 && goodClasses[0] === ""))) {
            // Return all children that have text content
            return {
                children: children.filter(function () {
                    return this.nodeName &&
                        !["script", "img", "meta", "style"].includes(this.nodeName.toLowerCase()) &&
                        !!$(this).text().trim().length;
                }),
                goodClasses: []
            };
        }

        return { children: children, goodClasses: goodClasses };
    }

    // Filter children that match at least one of the good class combinations
    var matchingChildren = children.filter(function () {
        var $this = $(this);
        var hasMatch = false;

        // Check if this element's classes match any good combination
        goodClassCombos.forEach(function (combo) {
            var comboClasses = combo.split(" ");
            // Check if element has ALL classes in the combination
            var matchesAll = comboClasses.every(function (cls) {
                return $this.hasClass(cls);
            });
            hasMatch = hasMatch || matchesAll;
        });

        return hasMatch;
    });

    return {
        children: matchingChildren,
        goodClasses: goodClassCombos
    };
}

/**
 * Generate a unique CSS selector for an element
 * 
 * @param {Element} element - The DOM element
 * @returns {string} - CSS selector string
 */
function generateCSSSelector(element) {
    // Trigger events to ensure element state is clean
    $(element).trigger("mouseleave").trigger("blur");

    // Build selector by walking up the DOM tree
    return $(element).parents().addBack()
        .not("html")        // Exclude html element
        .not("body")        // Exclude body element
        .map(function () {
            var selector = this.tagName.toLowerCase(); // Start with tag name

            // Add ID selector if it exists and doesn't contain only digits
            // (avoids dynamic IDs that change)
            if (typeof this.id === "string" && this.id.trim() && !this.id.match(/\d+/g)) {
                selector += escapeSelector(this.id, "#");
            }

            // Add class selectors if className exists
            if (typeof this.className === "string" && this.className.trim()) {
                // Join multiple classes with dots and escape special characters
                var classes = this.className.trim().split(/\s+).filter(function (c) { return c.length > 0; });
                selector += classes.map(function (cls) {
                    return escapeSelector(cls, ".");
                }).join("");
            }

            return selector;
        })
        .get()          // Convert jQuery object to array
        .join(">");     // Join all parts with > for hierarchy
}

/**
 * Main table detection function
 * Scans the document for potential table candidates
 * 
 * @returns {Array} - Array of table candidates sorted by score (descending)
 */
function findTables() {
    var candidates = [];      // Store all table candidates
    var bodyArea = $("body").width() * $("body").height(); // Viewport area
    var maxCandidates = 5;    // How many top candidates to return (same as extension)

    // Examine every element in the body
    $("body *").each(function () {
        var elementArea = this.offsetWidth * this.offsetHeight;

        // Skip elements that are too small (less than 2% of viewport)
        // or have invalid dimensions
        if (isNaN(elementArea) || elementArea < 0.02 * bodyArea) {
            return; // Skip to next element (continue in each loop)
        }

        // Run pattern detection on this element
        var patternResult = detectTablePattern(this);
        var matchingChildren = patternResult.children;
        var childCount = matchingChildren.length;

        // Must have at least 3 matching children to be considered a table
        if (isNaN(childCount) || childCount < 3) {
            return; // Skip to next element
        }

        // Calculate score: area × (children count)²
        // This favors larger elements with more children (typical of data tables)
        var score = elementArea * (childCount * childCount);

        // Add candidate to our list
        candidates.push({
            element: this,                    // The DOM element
            goodClasses: patternResult.goodClasses, // Common class patterns
            area: elementArea,                // Element's area
            children: matchingChildren,       // Matching child elements
            text: matchingChildren.text(),    // Combined text of children
            score: score,                     // Calculated score
            selector: generateCSSSelector(this), // Unique CSS selector
            type: "selector"                  // Type identifier (from extension)
        });
    });

    // Sort candidates by score (highest first) and return top N
    return candidates.sort(function (a, b) {
        return b.score - a.score;
    }).slice(0, maxCandidates);
}

/**
 * Example usage function
 * Demonstrates how to use the detection algorithm
 */
function demoUsage() {
    console.log("=== Instant Data Scraper Table Detection Demo ===");
    console.log("Scanning document for potential tables...");

    var tables = findTables();

    console.log("Found " + tables.length + " potential table candidates:\n");

    tables.forEach(function (table, index) {
        console.log("--- Candidate #" + (index + 1) + " ---");
        console.log("Selector: " + table.selector);
        console.log("Score: " + table.score.toFixed(2));
        console.log("Element area: " + table.area.toFixed(2) + " px²");
        console.log("Matching children: " + table.children.length);
        console.log("Good classes: " + (table.goodClasses.length > 0 ?
            table.goodClasses.join(", ") :
            "[none - using structural match]"));
        console.log("Sample text: " +
            (table.text.length > 100 ?
                table.text.substring(0, 100) + "..." :
                table.text));
        console.log("Element:", table.element);
        console.log("");
    });

    if (tables.length === 0) {
        console.log("No table candidates found. Try adjusting the detection thresholds.");
    } else {
        console.log("To test a selector, you can run in console:");
        console.log("  document.querySelector('" + tables[0].selector + "')");
        console.log("");
        console.log("Tip: Higher scores indicate more likely table candidates.");
    }
}

// Run demo when script is loaded (if jQuery is available)
if (typeof jQuery !== "undefined") {
    // Wait for DOM to be ready
    $(function () {
        setTimeout(demoUsage, 1000); // Delay slightly to let page load
    });
} else {
    console.error("Error: This demo requires jQuery to function. " +
        "Please include jQuery before this script.");
}

// Export functions for potential use in other contexts
window.InstantDataScraperDemo = {
    findTables: findTables,
    detectTablePattern: detectTablePattern,
    generateCSSSelector: generateCSSSelector,
    getClasses: getClasses,
    escapeSelector: escapeSelector,
    getDirectText: getDirectText,
    demoUsage: demoUsage
};
