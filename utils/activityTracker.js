import storage from "./storage.js";

const LIBRARY_ACTIVITY_KEY = "library_activity_timestamp";

function getActivityData() {
    return storage.get(LIBRARY_ACTIVITY_KEY) || {};
}

function trackItemActivity(itemId) {
    if (!itemId) return;

    try {
        const activityData = getActivityData();
        activityData[itemId] = Date.now();
        storage.set(LIBRARY_ACTIVITY_KEY, activityData);
    } catch (error) {
        console.error("Không thể ghi lại hoạt động của item:", error);
    }
}

const activityTracker = {
    getActivityData,
    trackItemActivity,
};

export default activityTracker;
