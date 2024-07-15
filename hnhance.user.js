// ==UserScript==
// @name         HNhance
// @namespace    elpocko
// @version      1.3
// @description  Hacker News Enhancer
// @icon         https://news.ycombinator.com/favicon.ico
// @author       elpocko
// @match        https://news.ycombinator.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(() => {
    'use strict';

    const STYLES = {
        default: '',
        dark: 'filter: invert(80%) hue-rotate(180deg) contrast(110%);',
        darkest: 'filter: invert(100%) hue-rotate(180deg);',
    }

    const UNDIM = `
        .c5a, .c73, .c82, .c88, .c9c, .cae, .cbe, .cce, .cdd, .ca2,
        .c5a a:link, .c73 a:link, .c82 a:link, .c88 a:link, .c9c a:link, .cae a:link, .cbe a:link, .cce a:link, .cdd a:link,
        .c5a a:visited, .c73 a:visited, .c82 a:visited, .c88 a:visited, .c9c a:visited, .cae a:visited, .cbe a:visited, .cce a:visited, .cdd a:visited {
          color: #000 !important;
        }
    `

    const KIND_COMMENT = 1
    const KIND_SUBMISSION = 2

    const setStyle = style => {
        document.documentElement.style = STYLES[style]
    }

    const settings = new class Settings {
        constructor() {
            setStyle(this.style)
        }

        get undim() { return GM_getValue('hne_undim', false) }
        set undim(undim) { GM_setValue('hne_undim', undim) }

        get style() { return GM_getValue('hne_style', 'default') }
        set style(style) { GM_setValue('hne_style', style) }

        get blockUnvotable() { return GM_getValue('hne_block_unvotable', false) }
        set blockUnvotable(block) { GM_setValue('hne_block_unvotable', block ? true : false) }

        blockUser(id, kind, block) {
            let flags = this.#blockedUsers[id] || 0
            flags = block ? flags | kind : flags & ~kind
            if(flags == 0) {
                delete this.#blockedUsers[id]
            }
            else {
                this.#blockedUsers[id] = flags
            }

            GM_setValue('hne_blocked', this.#blockedUsers)
        }

        isUserBlocked(id, kind) {
            return ((this.#blockedUsers[id] || 0) & kind) == kind
        }

        blockDomain(domain, block) {
            if(!block) {
                delete this.#blockedDomains[domain]
            }
            else {
                this.#blockedDomains[domain] = true
            }

            GM_setValue('hne_blocked_domains', this.#blockedDomains)
        }

        isDomainBlocked(domain) {
            return this.#blockedDomains[domain] === true
        }

        exportJSON() {
            const json = JSON.stringify({
                version: 1,
                style: this.style,
                blockedUsers: this.#blockedUsers,
                blockedDomains: this.#blockedDomains,
                blockUnvotable: this.blockUnvotable,
            })

            const file = new File([json], 'hne_settings.json', { type: 'octet/stream' })
            const blobUrl = URL.createObjectURL(file)
            window.location.assign(blobUrl)
        }

        importJSON(json) {
            const o = JSON.parse(json)
            this.style = o.style || this.style
            this.blockUnvotable = o.blockUnvotable
            this.#blockedUsers = o.blockedUsers || {}
            this.#blockedDomains = o.blockedDomains || {}
            GM_setValue('hne_blocked', this.#blockedUsers)
            GM_setValue('hne_blocked_domains', this.#blockedDomains)
        }

        #blockedUsers = GM_getValue('hne_blocked', {})
        #blockedDomains = GM_getValue('hne_blocked_domains', {})
    }()

    const createElement = (parent, type, content = "", attrs = {}, props = {}) => {
        const el = document.createElement(type)
        el.innerHTML = content
        if(parent) parent.appendChild(el)
        for(const attr in attrs) {
            el.setAttribute(attr, attrs[attr])
        }
        for(const prop in props) {
            el[prop] = props[prop]
        }
        return el
    }

    // -- UI ----------------------------------------------------------------

    let menu, menuButton

    const toggleMenu = ev => {
        if(ev) ev.preventDefault()
        if(menu.offsetParent === null) {
            const r = menuButton.getBoundingClientRect()
            menu.style.display = 'inline'
            menu.style.left = r.right - menu.offsetWidth
            menu.style.top = r.bottom
        }
        else {
            menu.style.display = 'none'
        }
    }

    const styleUI = parent => {
        createElement(parent, 'label', 'Page style: &nbsp;', { for: 'styleselector' })
        const options = Object.keys(STYLES).map(s => `<option value="${s}">${s}</option>`).join('\n')
        const styleSelector = createElement(parent, 'select', options, {
            id: 'styleselector',
        }, {
            value: settings.style,
            onchange: ev => {
                settings.style = ev.target.value
                setStyle(ev.target.value)
                toggleMenu()
            },
        })
        createElement(parent, 'br')

        createElement(parent, 'input', '', {
            type: 'checkbox',
            id: 'undimcheckbox',
        }, {
            checked: settings.undim ? 'checked' : null,
            onchange: ev => {
                settings.undim = ev.target.checked
                undimComments()
            },
        })
        const e = createElement(parent, 'label', 'Do not dim comments', { for: 'undimcheckbox' })
        createElement(parent, 'br')
    }

    const blockUI = onchange => {
        const menu = document.getElementById('hnemenu');
        createElement(menu, 'input', '', {
            type: 'checkbox',
            id: 'blockunvotable',
        }, {
            checked: settings.blockUnvotable ? 'checked' : null,
            onchange: ev => {
                settings.blockUnvotable = ev.target.checked
                if(onchange) onchange()
            },
        })
        createElement(menu, 'label', "Hide unvotable submissions", { for: 'blockunvotable' })
        createElement(menu, 'br')
    }

    const settingsUI = parent => {
        const form = createElement(parent, 'form')

        const browse = createElement(form, 'input', '', {
            type: 'file',
            style: 'display: none',
        }, {
            onchange: ev => {
                const reader = new FileReader()
                reader.onload = ev => {
                    settings.importJSON(ev.target.result)
                    alert("Settings imported. Reload page to use updated settings.")
                }
                reader.readAsText(browse.files[0])
            }
        })

        createElement(form, 'input', '', {
            type: 'button',
            value: "Export settings",
        }, {
            onclick: ev => {
                settings.exportJSON()
                toggleMenu()
            },
        })

        createElement(form, 'input', '', {
            type: 'button',
            class: 'default',
            style: 'margin-left: 1em',
            value: "Import settings",
        }, {
            onclick: ev => {
                browse.click()
                toggleMenu()
            },
        })
    }

    const userUI = () => {
        const menu = document.getElementById('hnemenu')
        const userId = document.querySelector('a.hnuser').textContent;
        [
            [ 'hideposts', KIND_SUBMISSION, `Hide ${userId}'s submissions` ],
            [ 'hidecomments', KIND_COMMENT, `Hide ${userId}'s comments` ]
        ].forEach(input => {
            const [ id, kind, text ] = input
            createElement(menu, 'input', '', {
                type: 'checkbox',
                id,
            }, {
                checked: settings.isUserBlocked(userId, kind) ? 'checked' : null,
                onchange: ev => { settings.blockUser(userId, kind, ev.target.checked) },
            })
            createElement(menu, 'label', text + '<br>', { for: id })
        })
    }

    const domainUI = () => {
        const domain = document.querySelector('.sitestr')?.textContent
        if(domain === undefined) return undefined
        const menu = document.getElementById('hnemenu')
        createElement(menu, 'input', '', {
            type: 'checkbox',
            id: 'blockdomain',
        }, {
            checked: settings.isDomainBlocked(domain) ? 'checked' : null,
            onchange: ev => { settings.blockDomain(domain, ev.target.checked) },
        })
        createElement(menu, 'label', `Hide domain ${domain}`, { for: 'blockdomain' })
        createElement(menu, 'br')
    }

    const startUI = () => {
        const topbar = document.querySelector('#hnmain table tbody tr')
        if(!topbar) return undefined

        const menuTD = topbar.firstChild.cloneNode()
        menuButton = createElement(menuTD, 'a', "&nbsp;☰", {
            href: 'javascript:void(null)',
        }, {
            onclick: toggleMenu,
        })

        menu = createElement(document.getElementById('hnmain'), 'div', '', {
            class: 'default',
            style: 'display: none; position: absolute; line-height: 150%; padding: 1em 1em 0em 1em; border: solid 1px #222; background-color: #f6f6ef;',
        })

        const menuDiv = createElement(menu, 'div', '', { id: 'hnemenu' })

        styleUI(menuDiv)
        createElement(menu, 'hr')
        settingsUI(menu)

        topbar.appendChild(menuTD)
    }

    // ----------------------------------------------------------------------

    const filterComments = () => {
        const logout = document.getElementById('logout')
        if(logout) logout.id = '' // prevents HN's collapse action tracking when logged in

        const things = document.querySelectorAll('.athing.comtr:not(.coll)')
        things.forEach(thing => {
            const userId = thing.querySelector('.hnuser')?.textContent
            if(userId === undefined || !settings.isUserBlocked(userId, KIND_COMMENT)) return undefined
            thing.querySelector('.togg.clicky')?.click()
        })

        if(logout) logout.id = 'logout'
    }

    const removeSubmission = el => {
        do {
            const s = el.nextSibling
            el.remove()
            el = s
            if(el?.classList?.contains('athing')) break // next thing
            if(el?.classList?.contains('morespace')) break // bottom of page
        } while(el)
    }

    const filterSubmissions = () => {
        const blockUnvotable = settings.blockUnvotable
        const things = document.querySelectorAll('.athing:not(.comtr)')
        things.forEach(thing => {
            const domain = thing.querySelector('.sitestr')?.textContent
            const userId = thing.nextSibling.querySelector('.hnuser')?.textContent
            if(
                (userId === undefined && blockUnvotable) ||
                (userId !== undefined && settings.isUserBlocked(userId, KIND_SUBMISSION)) ||
                (domain !== undefined && settings.isDomainBlocked(domain))
            ) {
                removeSubmission(thing)
            }
        })
    }

    const undimComments = () => {
        if(!settings.undim) {
            const s = document.getElementById('undimstyle')
            return s ? s.remove() : null
        }

        const style = document.createElement('style')
        style.id = 'undimstyle'
        style.textContent = UNDIM
        document.body.appendChild(style)
    }

    const newsContext = () => {
        blockUI(filterSubmissions)
        filterSubmissions()
    }

    const fromContext = () => {
        domainUI()
        filterSubmissions()
    }

    const threadsContext = () => {
        filterComments()
    }

    const userContext = () => {
        userUI()
    }

    const itemContext = () => {
        domainUI()
        filterComments()
    }

    const commentContext = () => {
        filterComments()
    }

    const start = () => {
        startUI()

        const context = ({
            '/':             newsContext,
            '/news':         newsContext,
            '/newest':       newsContext,
            '/active':       newsContext,
            '/front':        newsContext,
            '/invited':      newsContext,
            '/pool':         newsContext,
            '/ask':          newsContext,
            '/asknew':       newsContext,
            '/show':         newsContext,
            '/shownew':      newsContext,
            '/submitted':    newsContext,
            '/best':         newsContext,
            '/classic':      newsContext,
            '/noobstories':  newsContext,
            '/launches':     newsContext,
            '/from':         fromContext,
            '/item':         itemContext,
            '/threads':      threadsContext,
            '/user':         userContext,
            '/newcomments':  commentContext,
            '/bestcomments': commentContext,
            '/noobcomments': commentContext,
            '/highlights':   commentContext,
        })[window.location.pathname] || (() => {})

        undimComments()
        context()
    }

    if(['complete', 'loaded', 'interactive'].includes(document.readyState)) {
        start()
    } else {
        document.addEventListener('DOMContentLoaded', start);
    }
})();
