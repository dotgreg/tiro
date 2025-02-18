import React, { useEffect, useRef, useState } from 'react';
import { iFileImage } from '../../../shared/types.shared';
import { getUrlTokenParam } from '../hooks/app/loginToken.hook';
import { detachNote } from '../managers/detachNote.manager';
import { cssVars } from '../managers/style/vars.style.manager';
import { absoluteLinkPathRoot } from '../managers/textProcessor.manager';
import { ButtonsToolbar } from './ButtonsToolbar.component';

export const Lightbox = (p: {
	images: iFileImage[]
	startingIndex: number
	onClose: Function
}) => {
	const [currIndex, setCurrIndex] = useState(0)
	useEffect(() => {
		setCurrIndex(p.startingIndex)
	}, [p.startingIndex])
	const incrementIndex = (direction: 1 | -1) => {
		let nIndex = currIndex
		if (direction === -1 && currIndex === 0) nIndex = p.images.length - 1
		else if (direction === 1 && currIndex === p.images.length - 1) nIndex = 0
		else nIndex = currIndex + direction
		setCurrIndex(nIndex)
		setZoomLevel(10)
	}

	//
	// zooming mechanism
	//
	const [zoomLevel, setZoomLevel] = useState(10)
	const zoom = (dir: -1 | 1) => {
		let nLevel = dir + zoomLevel
		if (nLevel < 0) nLevel = 0
		if (nLevel > 20) nLevel = 20
		setZoomLevel(nLevel)
	}
	const imgsRef = useRef<any[]>([])
	const getZoomDims = (id) => {
		const updateDims = () => {
			const cImgRef = document.getElementById(id) as HTMLImageElement
			const wrapperRef = document.getElementById(`lightbox-image-id`) as HTMLElement

			let percent = ((zoomLevel - 10) * 50) + 99
			if (zoomLevel < 10) percent = (-(10 - zoomLevel) * 10) + 99
			// let val = `${percent}%`
			// let res: any = { height: val }
			if (cImgRef && wrapperRef) {
				cImgRef.style.transform = `scale(${percent/100})`
				cImgRef.style.transformOrigin = `top left`
				let iw = cImgRef.naturalWidth
				let ih = cImgRef.naturalHeight
				let ir = iw/ih
				let ww = wrapperRef.offsetWidth
				let wh = wrapperRef.offsetHeight
				let wr = ww/wh

				// if ratio image < ratio wrapper = image height LONGER = should fit to wrapper height => MOST OF THE CASE?
				if (ir < wr) cImgRef.style.height = `${wh-10}px`
				if (ir > wr) cImgRef.style.width = `${ww-10}px`
			}
		}
		setTimeout(() => {updateDims()}, 50)
		return {}
	}
	const zoomContainerRef = useRef<any>(null)
	const getLineHeight = () => {
		let res = `0px`
		if (zoomContainerRef.current) {
			let h = zoomContainerRef.current.clientHeight
			res = `${h-5}px`
		}
		return res
	}
	let lineHeight = getLineHeight()

	return (
		<div className={`lightbox-component`}>
			<div className={`lightbox-bg`} onClick={() => { p.onClose() }}>
			</div>
			<div
				className={`lightbox-content images-nb-${p.images.length}`}
				ref={zoomContainerRef}
			>
				{
					p.images.map((image, key) =>
						<div
							key={key}
							id={`lightbox-image-id`}
							className={`lightbox-image`}
							style={{ display: key === currIndex ? 'flex' : 'none' }}
						>
							<div
								className="image-zoom-wrapper"
								style={{ lineHeight }}>
								<img
									// ref={ref => {imgsRef.current[key] = ref}}
									id={`img-lightbox-id-${key}`}
									style={getZoomDims(`img-lightbox-id-${key}`)}
									src={absoluteLinkPathRoot(image.url) + getUrlTokenParam()} />
							</div>
							<div className="image-infos">
								<div className="image-name" onClick={e => detachNote(image.file)}>
									{image.file.name} - {image.title}
								</div>
								<ButtonsToolbar
									popup={false}
									buttons={[
										{
											class: 'left',
											title: 'left',
											icon: 'faChevronLeft',
											action: () => { incrementIndex(-1) }
										},
										{
											class: 'zoom',
											title: 'zoom',
											icon: 'faPlus',
											action: () => { zoom(1) }
										},
										{
											class: 'dezoom',
											title: 'dezoom',
											icon: 'faMinus',
											action: () => { zoom(-1) }
										},
										{
											class: 'close',
											title: 'close',
											icon: 'faTimes',
											action: () => { p.onClose() }
										},
										{
											class: 'right',
											title: 'right',
											icon: 'faChevronRight',
											action: () => { incrementIndex(+1) }
										},
									]}
								/>
							</div>
						</div>
					)
				}
			</div>
		</div>
	)
}

export const lightboxCss = () => `
.lightbox-component {
    position: fixed;
		z-index: 1500;
    top: 0px;
    left: 0px;
    width: 100vw;
    height: 100vh;
    
    .lightbox-bg {
        top: 0px;
        left: 0px;
        width: 100vw;
        height: 100vh;
        position: absolute;
				background: rgb(0 0 0 / 82%);
    }

    .lightbox-content {
				&.images-nb-1 {
						.left, .right {
								display: none!important;
						}
				}

				border-radius: 9px;
				overflow: hidden;
        position: absolute;
        width: 95vw;
        height: 95vh;
        background: black;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%); 
				.zoom {
					top: 3px;
					left: 25px;
				}
				.dezoom {
					top: 3px;
					left: 8px;
				}
				.zoom, .dezoom {
						position: absolute;
						
						z-index: 100;
						height: 43px;
						margin-right: 5px;
						svg path {
								box-shadow: 0px 0px 5px #0006;
						}
				}
				svg {
						background: white;
						padding: 3px;
						border-radius: 22px;
						width: 13px;
						box-shadow: 0px 0px 5px #00000040;

				}

        .lightbox-image {
            position: relative;
            justify-content: space-around;
            align-items: center;
            width: 100%;
            height: 100%;

            &:hover {
                .image-infos {
                    display: block;
                }
            }
            .image-infos {
								position: absolute;
								top: 0px;
								height: 55px;
								left: 0px;
								width: 100%;
								background: linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 100%);
								ul {
										margin-top: 5px;
										justify-content: flex-end;
										height: 95vh;
										position: relative;
										margin: 0px;
										li {
												&.left,
												&.right {
														position: absolute;
														top: 0px;
														height: 100%;
														width: 20%;
														display: flex;
														justify-content: space-evenly;
														button {
																display: none;
																width: 100%;
														}
														&:hover {
																button {
																		display: block;
																}
														}
												}
												&.left {
														left: 0px;
														z-index:3;
												}	
												&.right {
														right: 0px;
														z-index:3;
												}	
												&.close {
														padding: 10px;
														position:relative;
														z-index:4;
														
												}
										}
								}

                // position: relative;
                &:hover {
                    .image-name {
                        display: block;
                    }
                }
                .image-name {
                    display: none;
                    cursor: pointer;
                    color: grey;
                    padding: 5px;
                    font-size: 10px;
                    position: absolute;
                    top: 5px;
                    left: 5px;
                }
            }
						.image-zoom-wrapper {
								width: 100%;
								height: 100%;
								text-align: center;
								overflow: auto;
								position: relative;
								z-index: 2;
								img {
		vertical-align: middle;
										/* max-width: 95vw; */
										z-index:2;
										/* position: relative; */
										/* max-height: 95vh; */
								}
						}
        }
    }

}
`
