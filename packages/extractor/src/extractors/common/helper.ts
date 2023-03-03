import { YouTube } from 'youtube-sr';

export const createImport = (lib: string) => import(lib).catch(() => null);

export const YouTubeLibs = [
    'ytdl-core',
    'play-dl',
    '@distube/ytdl-core'
    // add more to the list if you have any
];

// forced lib
const forcedLib = process.env.DP_FORCE_YTDL_MOD;
if (forcedLib) YouTubeLibs.unshift(forcedLib);

export const getFetch =
    typeof fetch !== 'undefined'
        ? fetch
        : async (...params: unknown[]) => {
              // eslint-disable-next-line
              let dy: any;

              /* eslint-disable no-cond-assign */
              if ((dy = await createImport('undici'))) {
                  return (dy.fetch || dy.default.fetch)(...params);
              } else if ((dy = await createImport('node-fetch'))) {
                  return (dy.fetch || dy.default)(...params);
              } else {
                  throw new Error('No fetch lib found');
              }

              /* eslint-enable no-cond-assign */
          };

export type StreamFN = (q: string) => Promise<import('stream').Readable | string>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadYtdl(options?: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lib: any, _ytLibName: string, _stream: StreamFN;

    for (const ytlib of YouTubeLibs) {
        lib = await import(ytlib).then(
            (m) => m,
            () => null
        );
        if (!lib) continue;
        lib = lib.default || lib;
        _ytLibName = ytlib;
        break;
    }

    if (lib) {
        const isYtdl = ['ytdl-core', '@distube/ytdl-core'].some((lib) => lib === _ytLibName);

        _stream = async (query) => {
            if (isYtdl) {
                const dl = lib as typeof import('ytdl-core');
                const info = await dl.getInfo(query, options);

                const formats = info.formats
                    .filter((format) => {
                        return info.videoDetails.isLiveContent ? format.isHLS && format.hasAudio : format.hasAudio;
                    })
                    .sort((a, b) => Number(b.audioBitrate) - Number(a.audioBitrate) || Number(a.bitrate) - Number(b.bitrate));

                const fmt = formats.find((format) => !format.hasVideo) || formats.sort((a, b) => Number(a.bitrate) - Number(b.bitrate))[0];
                return fmt.url;
                // return dl(query, this.context.player.options.ytdlOptions);
            } else {
                const dl = lib as typeof import('play-dl');

                const info = await dl.video_info(query);
                const formats = info.format
                    .filter((format) => {
                        const re = /\/manifest\/hls_(variant|playlist)\//;
                        if (!format.url) return false;
                        if (info.video_details.live) return re.test(format.url) && typeof format.bitrate === 'number';
                        return typeof format.bitrate === 'number';
                    })
                    .sort((a, b) => Number(b.bitrate) - Number(a.bitrate));

                const fmt = formats.find((format) => !format.qualityLabel) || formats.sort((a, b) => Number(a.bitrate) - Number(b.bitrate))[0];
                return fmt.url!;
                // return (await dl.stream(query, { discordPlayerCompatibility: true })).stream;
            }
        };
    } else {
        throw new Error(`Could not load youtube library. Install one of ${YouTubeLibs.map((lib) => `"${lib}"`).join(', ')}`);
    }

    return { name: _ytLibName!, stream: _stream, lib };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function makeYTSearch(query: string, opt: any) {
    const res = await YouTube.search(query, {
        type: 'video',
        requestOptions: opt
    }).catch(() => {
        //
    });

    return res || [];
}
