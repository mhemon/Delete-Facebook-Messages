// ==UserScript==
// @name         Messenger Delete Chats Free
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Delete Messenger chats with an on-screen counter
// @match        https://www.messenger.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    let deletedCount = 0;
    let statusText = null;
    let running = false;

    const updateStatus = () => {
        if (!statusText) {
            return;
        }

        statusText.textContent = `Deleted chats: ${deletedCount}`;
    };

    const waitFor = async (predicate, timeout = 5000, interval = 250) => {
        const startedAt = Date.now();

        while (Date.now() - startedAt < timeout) {
            if (predicate()) {
                return true;
            }

            await delay(interval);
        }

        return false;
    };

    const clickLikeUser = (element) => {
        if (!element) {
            return;
        }

        const target = element.closest('button, [role="button"]') || element;
        const rect = target.getBoundingClientRect();
        const clientX = rect.left + rect.width / 2;
        const clientY = rect.top + rect.height / 2;

        target.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, cancelable: true, view: window, pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX, clientY }));
        target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 1, clientX, clientY }));
        target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window, clientX, clientY }));
        target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, buttons: 1, clientX, clientY }));
        target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, buttons: 0, clientX, clientY }));
        target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 0, clientX, clientY }));
        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX, clientY }));
    };

    const getVisibleDialog = () => {
        return [...document.querySelectorAll('[role="dialog"], [aria-modal="true"]')]
            .find(el => el.offsetParent !== null) || null;
    };

    const findConfirmDeleteButton = () => {
        const dialog = getVisibleDialog();

        if (!dialog) {
            return null;
        }

        const actionable = [...dialog.querySelectorAll('div[aria-label="Delete chat"][role="button"]')]
            .find(el => el.getAttribute('tabindex') === '0' && el.getAttribute('aria-disabled') !== 'true') || null;

        if (!actionable) {
            return null;
        }

        const rect = actionable.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const hitTarget = document.elementFromPoint(centerX, centerY);

        return hitTarget ? (hitTarget.closest('button, [role="button"]') || actionable) : actionable;
    };

    const getVisibleConversationLinks = () => {
        return [...document.querySelectorAll('a[role="link"][href^="/e2ee/t/"]')]
            .filter(el => el.offsetParent !== null);
    };

    const getCurrentConversationLink = () => {
        const visibleLinks = getVisibleConversationLinks();

        return visibleLinks.find(el => el.getAttribute('aria-current') === 'page') || visibleLinks[0] || null;
    };

    const getConversationKey = (link) => {
        if (!link) {
            return null;
        }

        const href = link.getAttribute('href');

        return href || null;
    };

    const isConversationStillActive = (conversationKey) => {
        if (!conversationKey) {
            return false;
        }

        const activeLink = document.querySelector('a[role="link"][href^="/e2ee/t/"][aria-current="page"]');

        if (!activeLink) {
            return false;
        }

        return activeLink.getAttribute('href') === conversationKey;
    };

    const focusNextConversation = (currentConversationKey) => {
        const links = getVisibleConversationLinks();

        if (!links.length) {
            return false;
        }

        const currentIndex = links.findIndex(link => link.getAttribute('href') === currentConversationKey);
        const nextLink = currentIndex >= 0 ? links[currentIndex + 1] : links[0];

        if (!nextLink) {
            return false;
        }

        clickLikeUser(nextLink);
        return true;
    };

    async function deleteChats() {

        running = true;

        while (running) {

            const currentLink = getCurrentConversationLink();
            const conversationKey = getConversationKey(currentLink);

            const menuBtn = document.querySelector(
                'div[role="button"][tabindex="0"][aria-haspopup="menu"][aria-controls="thread-list-menu-buttons"]'
            );

            if (!menuBtn) {
                console.log("No menu button found.");
                break;
            }

            menuBtn.click();

            await delay(1500);

            // Find Delete chat option
            const spans = [...document.querySelectorAll('span')];

            const deleteOption = spans.find(
                el => el.textContent.trim() === 'Delete chat'
            );

            if (!deleteOption) {
                console.log("Delete option not found.");
                break;
            }

            deleteOption.click();

            await delay(1500);

            // Confirm delete by finding the exact text span and clicking its wrapper
            const confirmDelete = findConfirmDeleteButton();

            if (!confirmDelete) {
                console.log("Confirm button not found.");
                break;
            }

            clickLikeUser(confirmDelete);
            await delay(500);
            clickLikeUser(confirmDelete);

            const dialogClosed = await waitFor(() => {
                const confirmButton = findConfirmDeleteButton();

                return !confirmButton;
            });

            if (!dialogClosed) {
                console.log("Delete dialog did not close.");
                break;
            }

            if (!focusNextConversation(conversationKey)) {
                console.log("Next conversation not found.");
                break;
            }

            const conversationGone = await waitFor(() => {
                return !isConversationStillActive(conversationKey);
            }, 7000, 250);

            if (!conversationGone) {
                console.log("Conversation still active after delete.");
                break;
            }

            deletedCount += 1;
            updateStatus();

            await delay(3000);
        }
    }

    // Create floating button
    const startBtn = document.createElement('button');

    startBtn.innerText = 'Delete All Chats';

    Object.assign(startBtn.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: '999999',
        background: 'red',
        color: 'white',
        border: 'none',
        padding: '12px 20px',
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: '16px'
    });

    startBtn.onclick = deleteChats;

    document.body.appendChild(startBtn);

    const stopBtn = document.createElement('button');

    stopBtn.innerText = 'Stop';

    Object.assign(stopBtn.style, {
        position: 'fixed',
        top: '20px',
        right: '160px',
        zIndex: '999999',
        background: '#444',
        color: 'white',
        border: 'none',
        padding: '12px 20px',
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: '16px'
    });

    stopBtn.onclick = () => {
        running = false;
        updateStatus();
    };

    document.body.appendChild(stopBtn);

    statusText = document.createElement('div');
    statusText.textContent = 'Deleted chats: 0';

    Object.assign(statusText.style, {
        position: 'fixed',
        top: '70px',
        right: '20px',
        zIndex: '999999',
        background: 'rgba(0, 0, 0, 0.75)',
        color: 'white',
        padding: '10px 14px',
        borderRadius: '10px',
        fontSize: '14px',
        fontFamily: 'sans-serif',
        boxShadow: '0 6px 18px rgba(0, 0, 0, 0.2)'
    });

    document.body.appendChild(statusText);

})();