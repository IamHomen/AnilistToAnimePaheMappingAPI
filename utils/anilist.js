import axios from 'axios';  // Importing axios with ES modules

export const getAniListTitle = async (anilistId) => {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        title {
          romaji
          english
          native
        }
      }
    }
  `;

  const variables = { id: anilistId };

  const response = await axios.post("https://graphql.anilist.co", {
    query,
    variables
  });

  const data = response.data.data.Media.title;
  return data.english || data.romaji || data.native;
};
