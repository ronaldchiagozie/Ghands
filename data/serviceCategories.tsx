import React from 'react';

/**
 * The shape a category takes on the home screen.
 *
 * This file used to also hold the categories themselves: eight trades typed
 * out by hand, each with its own little component wrapping a PNG. The app has
 * read its categories from the server for a long time and draws their icons
 * through utils/categoryIcons, so the list was dead - and dead in a way that
 * would have taken a build with it, because five of the eight images it asked
 * for no longer exist. Nothing imported the list, only the type, which is why
 * nobody noticed.
 *
 * The type stays here because the home screen names it. The list is gone.
 */
export interface ServiceCategory {
  id: string;
  title: string;
  icon: React.ComponentType;
}
