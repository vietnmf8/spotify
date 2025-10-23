import httpRequest from "../../utils/httpRequest.js";

class PlaylistService {
    #playlistsCache = null; // Lưu trữ Playlist
    #playlistsPromise = null; // Lưu trữ Promise -> tránh gọi API nhiều lần

    /* Tạo Playlist */
    async createPlaylist() {
        try {
            const response = await httpRequest.post("playlists", {
                name: "My Playlist",
                is_public: true,
            });
            // Xoá cache cũ sau khi tạo mới Playlist
            this.invalidatePlaylistsCache();
            return response;
        } catch (error) {
            console.error("Lỗi khi tạo playlist:", error);
            throw error;
        }
    }

    /* Cập nhật Playlist */
    async updatePlaylist(id, data) {
        try {
            const response = await httpRequest.put(`playlists/${id}`, data);
            // Xoá cache cũ sau khi cập nhật
            this.invalidatePlaylistsCache();
            return response;
        } catch (error) {
            console.error(`Lỗi khi cập nhật playlist ${id}:`, error);
            throw error;
        }
    }

    /* Tải ảnh bìa cho Playlist */
    async uploadPlaylistCover(id, formData) {
        try {
            const response = await httpRequest.post(
                `upload/playlist/${id}/cover`,
                formData
            );
            // Xoá cache cũ sau khi thay đổi ảnh
            this.invalidatePlaylistsCache();
            return response;
        } catch (error) {
            console.error(`Lỗi khi tải ảnh bìa cho playlist ${id}:`, error);
            throw error;
        }
    }

    /* Xoá Playlist */
    async deletePlaylist(playlistId) {
        try {
            const response = await httpRequest.del(`playlists/${playlistId}`);
            // Xoá cache cũ sau khi xoá playlist
            this.invalidatePlaylistsCache();
            return response;
        } catch (error) {
            console.error(`Lỗi khi xóa playlist ${playlistId}:`, error);
            throw error;
        }
    }

    /* Lấy danh sách Playlist của người dùng */
    async getMyPlaylists() {
        // Nếu có cache, trả về cache ngay
        if (this.#playlistsCache) {
            return this.#playlistsCache;
        }

        // Nếu đã có promise đang chạy, trả về promise đó để tránh gọi lại API
        if (this.#playlistsPromise) {
            return this.#playlistsPromise;
        }

        // Nếu chưa có, tạo một promise mới để fetch dữ liệu
        this.#playlistsPromise = (async () => {
            try {
                const response = await httpRequest.get("me/playlists");
                // Lưu danh sách Playlist vào cache
                this.#playlistsCache = response.playlists || [];
                return this.#playlistsCache;
            } catch (error) {
                console.error("Lỗi khi lấy danh sách playlist:", error);
                throw error;
            } finally {
                this.#playlistsPromise = null;
            }
        })();

        // Lưu lại Promise cho lần chạy tiếp theo
        return this.#playlistsPromise;
    }

    /* Lấy dữ liệu từ cache */
    getPlaylistsFromCache() {
        return this.#playlistsCache || [];
    }

    /* Xoá cache cũ khi dữ liệu thay đổi */
    invalidatePlaylistsCache() {
        this.#playlistsCache = null;
        this.#playlistsPromise = null;
    }

    /* Thêm một bài hát vào playlist */
    async addTrackToPlaylist(playlistId, trackId) {
        try {
            const response = await httpRequest.post(
                `playlists/${playlistId}/tracks`,
                {
                    track_id: trackId,
                }
            );
            return response;
        } catch (error) {
            console.error(
                `Lỗi khi thêm bài hát ${trackId} vào playlist ${playlistId}:`,
                error
            );
            throw error;
        }
    }

    /* Xóa một bài hát khỏi playlist */
    async removeTrackFromPlaylist(playlistId, trackId) {
        try {
            const response = await httpRequest.del(
                `playlists/${playlistId}/tracks/${trackId}`
            );
            return response;
        } catch (error) {
            console.error(
                `Lỗi khi xóa bài hát ${trackId} khỏi playlist ${playlistId}:`,
                error
            );
            throw error;
        }
    }
}

const playlistService = new PlaylistService();
export default playlistService;
