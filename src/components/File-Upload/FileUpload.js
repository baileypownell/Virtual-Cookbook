import React from 'react'
import './FileUpload.scss'
const { v4: uuidv4 } = require('uuid')

class FileUpload extends React.Component {

    state = {
        files: [],
        preExistingImageUrls: null,
        filesToDelete: [],
        defaultTileImageKey: null,
        defaultRemoved: false
    }

    componentDidMount() {
        this.props.preExistingImageUrls?.subscribe(preExistingImageUrls => {
            this.setState({
                preExistingImageUrls: preExistingImageUrls
            })
        })

        if (this.props.defaultTileImageUUID) {
            this.setState({
                defaultTileImageKey: this.props.defaultTileImageUUID
            }, () => this.props.passDefaultTileImage(this.state.defaultTileImageKey))
        }
    }
    
    openFileFinder = () => this.input.click()

    processFile(file) {
        let currentFiles = this.state.files
        if (this.state.files.length + this.state.preExistingImageUrls?.length === 5) {
            M.toast({html: 'Only 5 images allowed per recipe.'})
            return
        }
        if ((file.type === 'image/jpeg' || file.type === 'image/png')) {
            currentFiles.push({
                file: file,
                id: uuidv4()
            })
            this.setState({
                files: currentFiles
            }, () => this.props.passFiles(this.state.files))
        }
    }

    handleDrop = (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.dataTransfer.files && e.dataTransfer.items.length >=1 ) {
            Array.from(e.dataTransfer.files).forEach(file => this.processFile(file))
        }
    }

    handleUpload = (e) => {
        Array.from(e.target.files).forEach(file => this.processFile(file))
    }

    removeFile(fileId) {
        let updatedFileList = [] 
        this.state.files.forEach(file => {
            if (file.id !== fileId) {
                updatedFileList.push(file)
            }
        })
        this.setState({
            files: updatedFileList
        }, () => {
            this.props.passFiles(this.state.files)
        })
    }

    stageAWSFileDeletion(url) {    
        let updatedFiles = this.state.preExistingImageUrls.filter(u => u !== url) 
        let filesToDelete = this.state.filesToDelete
        filesToDelete.push(url) 
        this.setState({
            preExistingImageUrls: updatedFiles,
            filesToDelete: filesToDelete
        }, () => { 
            this.props.passFilesToDelete(filesToDelete)
        })
    }

    setDefaultTileImage = (e) => {
        // get S3 key from id 
        let imageKey = e.target.id.split('amazonaws.com/')[1].split('?')[0]
        if (imageKey === this.state.defaultTileImageKey) {
            this.setState({
                defaultTileImageKey: null
            }, () => this.props.passDefaultTileImage(this.state.defaultTileImageKey))
        } else if (imageKey === this.props.defaultTileImageUUID) {
            if (!this.state.defaultRemoved) {
                this.setState({
                    defaultTileImageKey: null,
                    defaultRemoved: true 
                }, () => this.props.passDefaultTileImage(this.state.defaultTileImageKey))
            } else {
                this.setState({
                    defaultTileImageKey: imageKey,
                }, () => this.props.passDefaultTileImage(this.state.defaultTileImageKey))
            }
        } else {
            this.setState({
                defaultTileImageKey: imageKey,
                defaultRemoved: true 
            }, () => this.props.passDefaultTileImage(this.state.defaultTileImageKey))
        }
    }

    setDefaultTileImageNew = (file) => {
        if (file.name === this.state.defaultTileImageKey?.fileName) {
            this.setState({
                defaultTileImageKey: null
            }, () => this.props.passDefaultTileImage(this.state.defaultTileImageKey))
        } else {
            this.setState({
                defaultTileImageKey: {newFile: true, fileName: file.name}
            }, () => this.props.passDefaultTileImage(this.state.defaultTileImageKey))
        }
    }

    determineIfChecked = (url) => {
        // compare key in url to the present key 
        let key = url.split('amazonaws.com/')[1].split('?')[0]
        if (key === this.state.defaultTileImageKey || (
            key === this.props.defaultTileImageUUID && !this.state.defaultRemoved)) {
            return true
        } else {
            return false
        }
    }

    determineIfCheckedNew = (file) => {
        // compare file name to the present key 
        if (file.name === this.state.defaultTileImageKey?.fileName) {
            return true
        } else {
            return false
        }
    }

    input = React.createRef()

    render() {
        const { preExistingImageUrls, files } = this.state
        const limitReached = files.length + preExistingImageUrls?.length === 5
        return (
            <div className="file-upload">
                <div className="dropzone" onDrop={this.handleDrop} onDragOver={this.handleDrop}>
                    <input 
                        ref={i => this.input = i} 
                        type="file" 
                        id="input" 
                        disabled={limitReached}
                        onChange={this.handleUpload}
                        multiple>
                    </input>
                    <div>
                        <h1>Drag & Drop an image</h1>
                        <button 
                            onClick={this.openFileFinder} 
                            disabled={limitReached} 
                            className="waves-effect waves-light btn">Choose a file</button>
                        <span>(Limit 5)</span>
                        <i className="fas fa-file-upload"></i>
                    </div>
                </div>
                <div className="file-list">
                    {Array.from(files)?.map((file, index) => (
                        <div 
                            key={file.id}
                            className="file-preview z-depth-2" 
                            style={{ backgroundImage: `url(${URL.createObjectURL(file.file)})`  }}>
                            <div className="file-cover" >
                            <label htmlFor={file.id}>
                                <input 
                                    checked={this.determineIfCheckedNew(file.file)}
                                    type="checkbox" 
                                    onChange={(e) => this.setDefaultTileImageNew(file.file)} 
                                    className="filled-in" 
                                    id={file.id} />
                                    <span>Use as tile background image</span>
                                </label>
                                <i onClick={(e) => this.removeFile(file.id)} className="fas fa-trash"></i>
                            </div>
                        </div>
                    ))}
                    {preExistingImageUrls?.map((url, index) => (
                        <div
                            className="file-preview z-depth-2"
                            key={index}
                            style={{ backgroundImage: `url(${url})`  }}>
                            <div className="file-cover" >
                                <label htmlFor={url}>
                                    <input 
                                        checked={this.determineIfChecked(url)}
                                        type="checkbox" 
                                        onChange={(e) => this.setDefaultTileImage(e)} 
                                        className="filled-in" id={url} />
                                    <span>Use as tile background image</span>
                                </label>
                                <i onClick={(e) => this.stageAWSFileDeletion(url)} className="fas fa-trash"></i>
                            </div>
                        </div>
                    ))}
                </div>              
            </div>
        )
    }
}

export default FileUpload