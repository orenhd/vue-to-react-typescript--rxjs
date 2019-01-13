import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Subject } from 'rxjs/Subject';
import { combineLatest } from 'rxjs/observable/combineLatest';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/switchMap';
import 'rxjs/add/operator/withLatestFrom';

import keyBy from 'lodash/keyBy';
import flow from 'lodash/flow';
import values from 'lodash/values';
import sortBy from 'lodash/sortBy';

import * as iTunesService from "./services/iTunes.service";

import * as dataModels from './topTwentyAlbums.dataModels';

import * as viewModels from './topTwentyAlbums.viewModels';

import * as utils from './topTwentyAlbums.utils';

/* Local Storage Definitions, Methods and Init. */

const LOCAL_STORAGE_KEY: string = 'topTwentyAlbums';

interface localStorageObjModel {
    currentGenreId: number | null;
}

const _localStorageObj: localStorageObjModel = parseLocalStorageObj(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');

function parseLocalStorageObj(localStorageItem: string) {
    const parsedLocalStorageObj: any = JSON.parse(localStorageItem);
    return <localStorageObjModel>{
        currentGenreId: parseInt(parsedLocalStorageObj.currentGenreId, 10)
    }
}

/* Private State BehaviorSubjects */

const _genresMap$: BehaviorSubject<dataModels.ITunesGenresMap> = new BehaviorSubject<dataModels.ITunesGenresMap>({});
const _albumEntries$: BehaviorSubject<dataModels.ITunesAlbumEntry[]> = new BehaviorSubject<dataModels.ITunesAlbumEntry[]>([]);
const _currentGenreId$: BehaviorSubject<number | null> = new BehaviorSubject<number | null>(_localStorageObj.currentGenreId || null);

/* Effects-triggering Subjects */

const _genresToLoad$: Subject<null> = new Subject<null>();
const _albumEntriesToLoadByGenreId$: Subject<number> = new Subject<number>();

/* Methods */

export function setCurrentGenreId(genreId: number) {
    _currentGenreId$.next(genreId);
}

export function loadGenreIds(): void {
    _genresToLoad$.next();
}

export function loadAlbumEntriesByGenreId(genreId: number): void {
    _albumEntriesToLoadByGenreId$.next(genreId);
}

/* Effects */

const _genresToLoadSubscription$ = _genresToLoad$.switchMap(() => iTunesService.getGenres())
    .subscribe((genres: dataModels.ITunesGenre[]) => {
        const genresMap = keyBy(genres, 'id');
        _genresMap$.next(genresMap);

        const curGenreId: number = _localStorageObj.currentGenreId || genres[0].id;

        //loading genre ids is always followed by loading the selected genre albums list
        loadAlbumEntriesByGenreId(curGenreId);
    });

const _albumEntriesToLoadByGenreIdSubscription$ = _albumEntriesToLoadByGenreId$
    .switchMap((genreId: number) => {
        _currentGenreId$.next(genreId);
        return iTunesService.getTopTwentyAlbumsByGenreId(genreId);
    }).subscribe((albumEntries: dataModels.ITunesAlbumEntry[]) => {
        _albumEntries$.next(albumEntries);
    });

/* Public Selectors */

export const genres$: Observable<dataModels.ITunesGenre[]> = _genresMap$.map(genresMap => {
    if (!genresMap) return [];

    return flow([
        values,
        (genresArr: dataModels.ITunesGenre[]) => sortBy(genresArr, 'title')
    ])(genresMap);
});

export const currentGenre$: Observable<dataModels.ITunesGenre | null> = _currentGenreId$.withLatestFrom(_genresMap$, (currentGenreId, genresMap) => {
    if (!currentGenreId || !genresMap || !Object.keys(genresMap).length) return null;

    return genresMap[currentGenreId];
});

export const albumEntriesList$: Observable<viewModels.AlbumEntryListItem[]> = _albumEntries$.map((albumEntries) => {
    return utils.mapToListAlbumEntries(albumEntries);
});

/* Local Storage Subscription */

combineLatest(_currentGenreId$).subscribe(([currentGenreId]) => {
    _localStorageObj.currentGenreId = currentGenreId;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(_localStorageObj));
});

