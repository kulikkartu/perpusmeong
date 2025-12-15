import { renderStoryList, openStorySheet, closeStorySheet } from './library_view.js';

export function LibraryController({ loader, store, onOpenStory, onStart, onContinue }){
  let indexData = null;
  let selected = null;

  async function mount(){
    indexData = await loader.loadIndex();
    const stories = (indexData?.stories || indexData || []);
    renderStoryList(stories, (story) => {
      selected = story;
      onOpenStory?.(story);
      const hasBookmark = !!store.loadBookmark(story.story_id);
      openStorySheet(story, { hasBookmark }, {
        onStart: async () => { closeStorySheet(); await onStart(story); },
        onContinue: async () => { closeStorySheet(); await onContinue(story); }
      });
    });
  }

  return { mount };
}
