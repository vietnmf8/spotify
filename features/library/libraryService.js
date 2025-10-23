import httpRequest from "../../utils/httpRequest.js";
import storage from "../../utils/storage.js";
import playlistService from "../playlist/playlistService.js";

class LibraryService {
    #savedTrackIdsCache = null; // Lưu tạm các ID bài hát đã lưu
    #savedTrackIdsPromise = null; // Nếu đang có Request được chạy, dùng chung Request

    /* Follow Playlist/Artist */
    async followItem(type, id) {
        if (!storage.get("access_token")) {
            // Mở modal đăng nhập nếu chưa đăng nhập
            document.querySelector(".login-btn").click();
            throw new Error("User not Authenticated");
        }

        // Gọi API Follow
        const endpoint =
            type === "artist"
                ? `artists/${id}/follow`
                : `playlists/${id}/follow`;
        return await httpRequest.post(endpoint);
    }

    /* Unfollow Playlist/Artist */
    async unfollowItem(type, id) {
        if (!storage.get("access_token")) {
            document.querySelector(".login-btn").click();
            throw new Error("User not authenticated");
        }
        const endpoint =
            type === "artist"
                ? `artists/${id}/follow`
                : `playlists/${id}/follow`;
        return await httpRequest.del(endpoint);
    }

    /* Lấy danh sách Playlists/Artists đã lưu trong Library */
    async getLibraryContent() {
        if (!storage.get("access_token")) {
            return { playlists: [], artists: [] };
        }

        try {
            // Lấy Playlist được Create & Followed và Artist đã Followed
            const [
                createdPlaylistsData,
                followedPlaylistsData,
                followedArtistsData,
            ] = await Promise.all([
                // Playlists
                playlistService.getMyPlaylists(),
                httpRequest.get("me/playlists/followed"),

                // Artists
                httpRequest.get("me/following"),
            ]);

            // Tổng hợp tất cả Playlists
            const allPlaylists = [
                ...createdPlaylistsData,
                ...followedPlaylistsData.playlists,
            ];

            // Lọc trùng lặp playlists
            const uniquePlaylists = Array.from(
                new Map(allPlaylists.map((p) => [p.id, p])).values()
            );

            return {
                playlists: uniquePlaylists,
                artists: followedArtistsData.artists || [],
            };
        } catch (error) {
            console.error("Error fetching library content:", error);
            return { playlists: [], artists: [] };
        }
    }

    /* Lấy danh sách các track trong Liked Songs */
    async getLikedSongs() {
        if (!storage.get("access_token")) {
            throw new Error("User not authenticated");
        }
        return await httpRequest.get("me/tracks/liked");
    }

    /* Lấy ra Id của bài hát đã thích */
    async getLikedTrackIds() {
        if (!storage.get("access_token")) {
            return new Set();
        }

        try {
            const data = await this.getLikedSongs();
            const ids = data.tracks.map((track) => track.id);
            return new Set(ids);
        } catch (error) {
            console.error("Failed to fetch liked track IDs:", error);
            return new Set();
        }
    }

    /* Lấy ID của tất cả bài hát đã được lưu (Liked Songs & Playlist) */
    async getSavedTrackIds() {
        if (!storage.get("access_token")) {
            return new Set();
        }

        // Nếu có Promise đang được cache, trả về Promise đó
        if (this.#savedTrackIdsPromise) {
            return this.#savedTrackIdsPromise;
        }

        // Nếu có Id đang được cache, trả về ID đó
        if (this.#savedTrackIdsCache) {
            return this.#savedTrackIdsCache;
        }

        // Lần đầu fetch dữ liệu
        this.#savedTrackIdsPromise = (async () => {
            try {
                // Chạy song song 2 API lấy ra trackId trong Liked Songs & lấy toàn bộ My Playlist
                const likedTrackIdsPromise = this.getLikedTrackIds();
                const myPlaylistsPromise = playlistService.getMyPlaylists();

                const [likedTrackIds, myPlaylists] = await Promise.all([
                    likedTrackIdsPromise,
                    myPlaylistsPromise,
                ]);

                // Lấy toàn bộ My Playlist (ngoại trừ Liked Songs)
                const playlistTracksPromises = myPlaylists
                    .filter((p) => p.name !== "Liked Songs")
                    .map((playlist) =>
                        httpRequest.get(`playlists/${playlist.id}/tracks`)
                    );

                const playlistsTracks = await Promise.all(
                    playlistTracksPromises
                );

                // Lấy ra toàn bộ trackId trong Liked Songs & Playlist
                const allTrackIds = new Set(likedTrackIds);
                playlistsTracks.forEach((playlist) => {
                    playlist.tracks.forEach((track) => {
                        allTrackIds.add(track.track_id);
                    });
                });

                // Lưu toàn bộ id đó vào cache dữ liệu.
                this.#savedTrackIdsCache = allTrackIds;
                return this.#savedTrackIdsCache;
            } catch (error) {
                console.error("Failed to fetch all saved track IDs:", error);

                return new Set();
            } finally {
                // Xóa promise vì đã fetch xong
                this.#savedTrackIdsPromise = null;
            }
        })();

        return this.#savedTrackIdsPromise;
    }

    /* Xoá cache của savedTrackId */
    clearSavedTrackIdsCache() {
        this.#savedTrackIdsCache = null;
        this.#savedTrackIdsPromise = null;
    }

    /* Thích một bài hát */
    async likeTrack(trackId) {
        const result = await httpRequest.post(`tracks/${trackId}/like`);
        this.clearSavedTrackIdsCache();
        return result;
    }

    /* Bỏ thích một bài hát */
    async unlikeTrack(trackId) {
        const result = await httpRequest.del(`tracks/${trackId}/like`);
        this.clearSavedTrackIdsCache();
        return result;
    }
}

const libraryService = new LibraryService();
export default libraryService;
